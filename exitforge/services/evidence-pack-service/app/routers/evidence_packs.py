from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.models.evidence_pack import (
    GeneratePackRequest,
    GeneratePackResponse,
    DeliverPackRequest,
    EvidencePackRecord,
    CaseContext,
)
from app.pipeline import run_generation_pipeline

settings = get_settings()
log = logging.getLogger(__name__)

router = APIRouter(prefix="/evidence-packs", tags=["Evidence Packs"])


def get_db():
    """Retrieve MongoDB collection from app state."""
    from app.main import get_db as _get_db
    return _get_db()


async def _get_db_async():
    from app.main import get_db as _get_db
    return _get_db()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GeneratePackResponse, status_code=202)
async def generate_pack(
    req: GeneratePackRequest,
    background_tasks: BackgroundTasks,
) -> GeneratePackResponse:
    """
    Trigger evidence pack generation for a case.
    Returns immediately with pack_id. Generation runs in background.
    """
    db = get_db()

    pack_id = f"ep_{uuid.uuid4().hex[:16]}"
    now = datetime.utcnow().isoformat()

    record: dict[str, Any] = {
        "_id": pack_id,
        "case_id": req.case_id,
        "status": "GENERATING",
        "version": 1,
        "triggered_by": req.triggered_by,
        "delivery_method": req.delivery_method,
        "attorney_email": req.attorney_email,
        "created_at": now,
        "updated_at": now,
    }

    # Check if a pack already exists for this case and increment version
    latest = await db["evidence_packs"].find_one(
        {"case_id": req.case_id},
        sort=[("version", -1)],
    )
    if latest:
        record["version"] = latest.get("version", 1) + 1

    await db["evidence_packs"].insert_one(record)

    background_tasks.add_task(
        run_generation_pipeline,
        pack_id=pack_id,
        case_id=req.case_id,
        delivery_method=req.delivery_method,
        attorney_email=req.attorney_email,
        personal_note=req.personal_note,
    )

    log.info("evidence_pack_generation_started", pack_id=pack_id, case_id=req.case_id)

    return GeneratePackResponse(pack_id=pack_id, status="GENERATING")


@router.get("/{pack_id}", response_model=EvidencePackRecord)
async def get_pack(pack_id: str) -> EvidencePackRecord:
    """Get evidence pack status and metadata."""
    db = get_db()
    doc = await db["evidence_packs"].find_one({"_id": pack_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Evidence pack not found")
    doc["id"] = doc.pop("_id")
    return EvidencePackRecord(**{k: v for k, v in doc.items() if k in EvidencePackRecord.model_fields})


@router.get("/case/{case_id}")
async def get_packs_for_case(case_id: str) -> dict:
    """List all evidence packs for a case, most recent first."""
    db = get_db()
    cursor = db["evidence_packs"].find(
        {"case_id": case_id},
        sort=[("version", -1)],
    )
    packs = await cursor.to_list(length=20)
    for p in packs:
        p["id"] = p.pop("_id")
    return {"packs": packs, "count": len(packs)}


@router.get("/{pack_id}/download")
async def download_pack(pack_id: str) -> RedirectResponse:
    """
    Redirect to a 7-day pre-signed S3 URL for the pack PDF.
    Returns 409 if the pack is still generating.
    """
    db = get_db()
    doc = await db["evidence_packs"].find_one({"_id": pack_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Evidence pack not found")

    status = doc.get("status", "")
    if status == "GENERATING":
        raise HTTPException(status_code=409, detail="Pack is still generating — check back shortly")
    if status == "FAILED":
        raise HTTPException(status_code=422, detail=f"Pack generation failed: {doc.get('error_message', 'Unknown error')}")

    s3_key = doc.get("s3_key")
    if not s3_key:
        raise HTTPException(status_code=404, detail="Pack PDF not available")

    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        config=Config(signature_version="s3v4"),
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
        ExpiresIn=settings.presigned_url_expiry_seconds,
    )
    return RedirectResponse(url=url, status_code=302)


@router.post("/{pack_id}/deliver", status_code=200)
async def deliver_pack(
    pack_id: str,
    req: DeliverPackRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """Deliver an existing READY pack to an attorney."""
    db = get_db()
    doc = await db["evidence_packs"].find_one({"_id": pack_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Evidence pack not found")
    if doc.get("status") != "READY":
        raise HTTPException(status_code=409, detail=f"Pack is not READY (status: {doc.get('status')})")

    background_tasks.add_task(
        _deliver_pack_task,
        pack_id=pack_id,
        s3_key=doc["s3_key"],
        case_id=doc["case_id"],
        attorney_email=req.attorney_email,
        delivery_method=req.delivery_method,
        personal_note=req.personal_note,
        pack_content=doc,
    )
    return {"message": "Delivery initiated", "pack_id": pack_id}


@router.post("/{pack_id}/regenerate", status_code=202)
async def regenerate_pack(
    pack_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """Regenerate a pack with the latest case data, incrementing the version."""
    db = get_db()
    doc = await db["evidence_packs"].find_one({"_id": pack_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Evidence pack not found")

    # Create a new generation request mirroring the original
    req = GeneratePackRequest(
        case_id=doc["case_id"],
        triggered_by="manual:regenerate",
        delivery_method=doc.get("delivery_method") or "PORTAL",
        attorney_email=doc.get("attorney_email"),
    )

    # Delegate to generate endpoint logic
    from fastapi import Request
    new_pack_id = f"ep_{uuid.uuid4().hex[:16]}"
    now = datetime.utcnow().isoformat()
    await db["evidence_packs"].insert_one({
        "_id": new_pack_id,
        "case_id": doc["case_id"],
        "status": "GENERATING",
        "version": (doc.get("version", 1) + 1),
        "triggered_by": "manual:regenerate",
        "delivery_method": req.delivery_method,
        "attorney_email": req.attorney_email,
        "regenerated_from": pack_id,
        "created_at": now,
        "updated_at": now,
    })

    background_tasks.add_task(
        run_generation_pipeline,
        pack_id=new_pack_id,
        case_id=doc["case_id"],
        delivery_method=req.delivery_method,
        attorney_email=req.attorney_email,
    )

    return {"pack_id": new_pack_id, "status": "GENERATING", "version": doc.get("version", 1) + 1}


# ─── Internal delivery task ───────────────────────────────────────────────────

async def _deliver_pack_task(
    pack_id: str,
    s3_key: str,
    case_id: str,
    attorney_email: str,
    delivery_method: str,
    personal_note: str | None,
    pack_content: dict,
) -> None:
    from app.delivery import send_pack_email
    db = get_db()

    try:
        await send_pack_email(
            s3_key=s3_key,
            pack_id=pack_id,
            case_id=case_id,
            attorney_email=attorney_email,
            personal_note=personal_note,
            pack_metadata=pack_content,
        )
        now = datetime.utcnow().isoformat()
        await db["evidence_packs"].update_one(
            {"_id": pack_id},
            {"$set": {
                "status": "DELIVERED",
                "delivered_to": attorney_email,
                "delivered_at": now,
                "delivery_method": delivery_method,
                "updated_at": now,
            }},
        )
        log.info("evidence_pack_delivered", pack_id=pack_id, attorney=attorney_email)
    except Exception as exc:
        log.error("evidence_pack_delivery_failed", pack_id=pack_id, error=str(exc))

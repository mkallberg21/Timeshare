"""
Document Service — FastAPI entry point.

Endpoints:
  POST /analyze/contract   — full OCR + LLM analysis pipeline
  GET  /documents/{id}     — retrieve analysis report
  GET  /health
"""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings
from app.ocr.textract import extract_text_from_s3
from app.analysis.contract_analyzer import analyze_contract

settings = get_settings()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()

# MongoDB client (module-level singleton)
_mongo: AsyncIOMotorClient | None = None


def get_db():
    if _mongo is None:
        raise RuntimeError("MongoDB not initialized")
    return _mongo[settings.mongodb_db]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _mongo
    _mongo = AsyncIOMotorClient(settings.mongodb_uri)
    log.info("document_service_started", port=settings.port)
    yield
    _mongo.close()
    log.info("document_service_stopped")


app = FastAPI(
    title="ExitForge Document Service",
    description="OCR + AI contract intelligence pipeline",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── Models ───────────────────────────────────────────────────────────────────

class AnalyzeContractRequest(BaseModel):
    case_id: str
    s3_key: str = Field(..., description="S3 object key for the timeshare contract PDF")
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class AnalyzeContractResponse(BaseModel):
    document_id: str
    status: str  # PROCESSING | COMPLETE | FAILED
    message: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/analyze/contract", response_model=AnalyzeContractResponse, status_code=202)
async def analyze_contract_endpoint(
    req: AnalyzeContractRequest,
    background_tasks: BackgroundTasks,
):
    """
    Triggers the full document intelligence pipeline asynchronously:
    1. AWS Textract OCR
    2. Claude contract analysis
    3. Store results in MongoDB
    """
    db = get_db()

    # Insert placeholder document
    await db["documents"].insert_one({
        "_id": req.document_id,
        "case_id": req.case_id,
        "s3_key": req.s3_key,
        "status": "PROCESSING",
        "correlation_id": req.correlation_id,
    })

    background_tasks.add_task(
        _run_pipeline, req.case_id, req.s3_key, req.document_id, req.correlation_id
    )

    return AnalyzeContractResponse(
        document_id=req.document_id,
        status="PROCESSING",
        message="Analysis pipeline started. Poll /documents/{document_id} for results.",
    )


@app.get("/documents/{document_id}")
async def get_document(document_id: str):
    """Retrieve contract analysis report by document ID."""
    db = get_db()
    doc = await db["documents"].find_one({"_id": document_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc["id"] = doc.pop("_id")
    return doc


@app.get("/cases/{case_id}/documents")
async def get_case_documents(case_id: str):
    """List all document analysis reports for a case."""
    db = get_db()
    cursor = db["documents"].find({"case_id": case_id}, {"extracted_text": 0})
    docs = await cursor.to_list(length=50)
    for d in docs:
        d["id"] = d.pop("_id")
    return {"documents": docs}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "document-service"}


# ─── Pipeline runner ──────────────────────────────────────────────────────────

async def _run_pipeline(
    case_id: str,
    s3_key: str,
    document_id: str,
    correlation_id: str,
) -> None:
    db = get_db()
    try:
        log.info("ocr_started", case_id=case_id, document_id=document_id)
        ocr_result = await extract_text_from_s3(s3_key)

        log.info("analysis_started", case_id=case_id, document_id=document_id)
        analysis = await analyze_contract(ocr_result["full_text"], document_id)

        await db["documents"].update_one(
            {"_id": document_id},
            {
                "$set": {
                    "status": "COMPLETE",
                    "page_count": ocr_result["page_count"],
                    "word_count": ocr_result["word_count"],
                    **analysis,
                }
            },
        )

        log.info("analysis_complete", case_id=case_id, document_id=document_id,
                 misrepresentation_count=len(analysis.get("misrepresentation_flags", [])))

    except Exception as e:
        log.error("pipeline_failed", case_id=case_id, document_id=document_id, error=str(e))
        await db["documents"].update_one(
            {"_id": document_id},
            {"$set": {"status": "FAILED", "error": str(e)}},
        )

from __future__ import annotations

"""
Assembly pipeline: orchestrates all 11 assemblers, generates PDF, uploads to S3,
updates MongoDB, emits Kafka events.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any

import aioboto3
import httpx
from aiokafka import AIOKafkaProducer
from anthropic import AsyncAnthropic

from app.config import get_settings
from app.models.evidence_pack import (
    CaseContext,
    EvidencePackContent,
)
from app.assemblers.executive_summary import ExecutiveSummaryAssembler
from app.assemblers.client_declaration import ClientDeclarationAssembler
from app.assemblers.contract_analysis import ContractAnalysisAssembler
from app.assemblers.misrepresentation_matrix import MisrepresentationMatrixAssembler
from app.assemblers.applicable_law import ApplicableLawAssembler
from app.assemblers.financial_impact import FinancialImpactAssembler
from app.assemblers.resort_profile import ResortProfileAssembler
from app.assemblers.negotiation_history import NegotiationHistoryAssembler
from app.assemblers.demand_letter import DemandLetterAssembler
from app.assemblers.cfpb_complaint import CfpbComplaintAssembler
from app.assemblers.supporting_documents import SupportingDocumentsAssembler
from app.pdf.generator import generate_pdf

settings = get_settings()
log = logging.getLogger(__name__)


async def _fetch_case_context(case_id: str) -> CaseContext:
    """Fetch full case context from case-service."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{settings.case_service_url}/cases/{case_id}",
        )
        resp.raise_for_status()
        data = resp.json()
        return CaseContext(**data.get("data", data))


async def _fetch_document_presigned_urls(case_id: str) -> list[dict]:
    """Fetch documents associated with a case from document-service."""
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{settings.document_service_url}/documents/case/{case_id}",
            )
            if resp.status_code == 200:
                return resp.json().get("documents", [])
    except Exception as exc:
        log.warning("document_fetch_failed", case_id=case_id, error=str(exc))
    return []


async def _emit_kafka_event(event_type: str, aggregate_id: str, payload: dict) -> None:
    try:
        producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_brokers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            client_id=settings.kafka_client_id,
        )
        await producer.start()
        try:
            envelope = {
                "eventId": str(uuid.uuid4()),
                "eventType": event_type,
                "aggregateId": aggregate_id,
                "timestamp": datetime.utcnow().isoformat(),
                "version": 1,
                "payload": payload,
                "metadata": {
                    "service": settings.service_name,
                    "correlationId": str(uuid.uuid4()),
                },
            }
            await producer.send_and_wait("exitforge.evidence-packs", value=envelope)
        finally:
            await producer.stop()
    except Exception as exc:
        log.error("kafka_emit_failed", event_type=event_type, error=str(exc))


async def run_generation_pipeline(
    pack_id: str,
    case_id: str,
    delivery_method: str,
    attorney_email: str | None,
    personal_note: str | None = None,
) -> None:
    """
    Full generation pipeline.
    1. Fetch case context
    2. Run all 11 assemblers (sequential ordering respects inter-section dependencies)
    3. Build EvidencePackContent
    4. Store content in MongoDB
    5. Generate PDF
    6. Upload PDF to S3
    7. Update EvidencePack record: READY
    8. Emit evidence_pack.ready Kafka event
    9. If delivery_method == EMAIL and attorney_email: send + mark DELIVERED
    """
    from app.main import get_db

    db = get_db()

    async def _mark_failed(error_message: str) -> None:
        await db["evidence_packs"].update_one(
            {"_id": pack_id},
            {"$set": {
                "status": "FAILED",
                "error_message": error_message,
                "updated_at": datetime.utcnow().isoformat(),
            }},
        )
        await _emit_kafka_event(
            "evidence_pack.failed",
            case_id,
            {"pack_id": pack_id, "reason": error_message},
        )

    try:
        # 1. Fetch case context
        log.info("pipeline_fetch_context", pack_id=pack_id, case_id=case_id)
        ctx = await _fetch_case_context(case_id)

        # Emit generation started
        await _emit_kafka_event(
            "evidence_pack.generation_started",
            case_id,
            {"pack_id": pack_id, "version": 1},
        )

        # 2. Create Claude client + run assemblers
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)

        log.info("pipeline_running_assemblers", pack_id=pack_id)

        # Independent sections can run in parallel; dependent ones run after
        (
            s1,
            s3,
            s6,
            s7,
            s8,
        ) = await asyncio.gather(
            ExecutiveSummaryAssembler(client, ctx).assemble(),
            ContractAnalysisAssembler(client, ctx).assemble(),
            FinancialImpactAssembler(client, ctx).assemble(),
            ResortProfileAssembler(client, ctx).assemble(),
            NegotiationHistoryAssembler(client, ctx).assemble(),
        )

        # s4 depends on s1 strength score; s2 and s9 depend on s3 leverage_score
        (
            s2,
            s4,
            s5,
        ) = await asyncio.gather(
            ClientDeclarationAssembler(client, ctx).assemble(),
            MisrepresentationMatrixAssembler(client, ctx).assemble(),
            ApplicableLawAssembler(client, ctx).assemble(),
        )

        # s9 demand letter is best when it has access to s4 entries and s7 resistance score
        (
            s9,
            s10,
        ) = await asyncio.gather(
            DemandLetterAssembler(client, ctx).assemble(),
            CfpbComplaintAssembler(client, ctx).assemble(),
        )

        # s11 does not call Claude — fetches S3 presigned URLs
        s11 = await SupportingDocumentsAssembler(client, ctx).assemble()

        # 3. Build content
        now_iso = datetime.utcnow().isoformat()
        content = EvidencePackContent(
            pack_id=pack_id,
            case_id=case_id,
            generated_at=now_iso,
            section1_executive_summary=s1,
            section2_client_declaration=s2,
            section3_contract_analysis=s3,
            section4_misrepresentation_matrix=s4,
            section5_applicable_law=s5,
            section6_financial_impact=s6,
            section7_resort_profile=s7,
            section8_negotiation_history=s8,
            section9_demand_letter_draft=s9,
            section10_cfpb_complaint_draft=s10,
            section11_supporting_documents=s11,
        )

        # 4. Store content in MongoDB
        log.info("pipeline_storing_content", pack_id=pack_id)
        await db["evidence_pack_contents"].replace_one(
            {"_id": pack_id},
            {"_id": pack_id, "case_id": case_id, **content.model_dump()},
            upsert=True,
        )

        # 5. Generate PDF
        log.info("pipeline_generating_pdf", pack_id=pack_id)
        pdf_bytes = await asyncio.get_event_loop().run_in_executor(
            None, generate_pdf, content, None
        )
        page_count = _estimate_page_count(len(pdf_bytes))

        # 6. Upload to S3
        s3_key = f"evidence-packs/{case_id}/{pack_id}/v1.pdf"
        log.info("pipeline_uploading_s3", pack_id=pack_id, key=s3_key)
        await _upload_to_s3(pdf_bytes, s3_key)

        # 7. Update record: READY
        strength_score = s1.strength_score if hasattr(s1, "strength_score") else 0.0
        await db["evidence_packs"].update_one(
            {"_id": pack_id},
            {"$set": {
                "status": "READY",
                "s3_key": s3_key,
                "page_count": page_count,
                "strength_score": strength_score,
                "generated_at": now_iso,
                "updated_at": datetime.utcnow().isoformat(),
            }},
        )

        # 8. Emit evidence_pack.ready
        await _emit_kafka_event(
            "evidence_pack.ready",
            case_id,
            {
                "pack_id": pack_id,
                "s3_key": s3_key,
                "page_count": page_count,
                "strength_score": strength_score,
                "attorney_email": attorney_email,
            },
        )

        log.info("pipeline_complete", pack_id=pack_id)

        # 9. Optionally deliver
        if delivery_method == "EMAIL" and attorney_email:
            from app.delivery import send_pack_email
            await send_pack_email(
                s3_key=s3_key,
                pack_id=pack_id,
                case_id=case_id,
                attorney_email=attorney_email,
                personal_note=personal_note,
                pack_metadata={"strength_score": strength_score, "page_count": page_count},
            )
            await db["evidence_packs"].update_one(
                {"_id": pack_id},
                {"$set": {
                    "status": "DELIVERED",
                    "delivered_to": attorney_email,
                    "delivered_at": datetime.utcnow().isoformat(),
                    "delivery_method": "EMAIL",
                    "updated_at": datetime.utcnow().isoformat(),
                }},
            )
            await _emit_kafka_event(
                "evidence_pack.delivered",
                case_id,
                {"pack_id": pack_id, "delivered_to": attorney_email, "method": "EMAIL"},
            )

    except Exception as exc:
        log.error("pipeline_failed", pack_id=pack_id, error=str(exc), exc_info=True)
        await _mark_failed(str(exc))


async def _upload_to_s3(pdf_bytes: bytes, s3_key: str) -> None:
    session = aioboto3.Session()
    async with session.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    ) as s3:
        await s3.put_object(
            Bucket=settings.s3_bucket_name,
            Key=s3_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
            ServerSideEncryption="AES256",
        )


def _estimate_page_count(pdf_size_bytes: int) -> int:
    """Rough estimate: ~50KB per page at WeasyPrint output quality."""
    return max(1, pdf_size_bytes // 51_200)

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import boto3
from botocore.config import Config

from app.assemblers.base import BaseAssembler
from app.models.evidence_pack import SupportingDocumentsSection, SupportingDocument
from app.config import get_settings

log = logging.getLogger(__name__)


class SupportingDocumentsAssembler(BaseAssembler):
    """
    Section 11: Supporting documents index with 7-day pre-signed URLs.
    Does NOT call Claude — purely assembles from case documents.
    """

    async def assemble(self) -> SupportingDocumentsSection:
        ctx = self.ctx
        settings = get_settings()

        s3 = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id or None,
            aws_secret_access_key=settings.aws_secret_access_key or None,
            config=Config(signature_version="s3v4"),
        )

        documents: list[SupportingDocument] = []
        for doc in ctx.documents:
            s3_key = doc.get("s3Key") or doc.get("s3_key", "")
            if not s3_key:
                continue

            try:
                presigned_url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
                    ExpiresIn=settings.presigned_url_expiry_seconds,
                )
            except Exception as exc:
                log.warning("presigned_url_failed", s3_key=s3_key, error=str(exc))
                presigned_url = f"s3://{settings.s3_bucket_name}/{s3_key}"

            doc_type = doc.get("type") or doc.get("documentType", "UNKNOWN")
            documents.append(
                SupportingDocument(
                    document_type=doc_type,
                    description=self._describe_document(doc_type),
                    s3_key=s3_key,
                    presigned_url=presigned_url,
                    uploaded_at=doc.get("uploadedAt") or doc.get("uploaded_at", ""),
                    relevance_to_case=self._relevance(doc_type),
                    page_references=[],
                )
            )

        missing = self._identify_missing(ctx.documents)

        return SupportingDocumentsSection(
            documents=documents,
            missing_document_recommendations=missing,
        )

    # No Claude call needed for this section
    async def _call_claude(self, *args, **kwargs):  # type: ignore
        raise NotImplementedError("SupportingDocumentsAssembler does not use Claude")

    def _system_prompt(self) -> str:
        return ""

    @staticmethod
    def _describe_document(doc_type: str) -> str:
        descriptions = {
            "TIMESHARE_CONTRACT": "Original timeshare purchase agreement — primary evidence document",
            "DEED": "Recorded deed showing ownership transfer",
            "MAINTENANCE_FEE_STATEMENT": "Annual maintenance fee billing statement",
            "DEMAND_LETTER": "Previously sent demand/exit request letter",
            "RESORT_RESPONSE": "Resort's written response to exit request",
            "CFPB_COMPLAINT": "Filed CFPB complaint",
            "AG_COMPLAINT": "Filed Attorney General complaint",
            "ATTORNEY_CORRESPONDENCE": "Attorney correspondence",
        }
        return descriptions.get(doc_type, f"Document: {doc_type}")

    @staticmethod
    def _relevance(doc_type: str) -> str:
        relevance = {
            "TIMESHARE_CONTRACT": "Primary source for all contractual contradiction evidence",
            "DEED": "Establishes ownership and chain of title",
            "MAINTENANCE_FEE_STATEMENT": "Evidence of ongoing financial burden; supports damages calculation",
            "DEMAND_LETTER": "Prior negotiation record; establishes timeline",
            "RESORT_RESPONSE": "Resort's position; may contain admissions or concessions",
            "CFPB_COMPLAINT": "Regulatory filing record",
            "AG_COMPLAINT": "State regulatory filing record",
            "ATTORNEY_CORRESPONDENCE": "Legal communications record",
        }
        return relevance.get(doc_type, "Supporting documentation")

    @staticmethod
    def _identify_missing(documents: list[dict]) -> list[str]:
        """Identify critical documents that are absent from the case file."""
        doc_types = {d.get("type") or d.get("documentType", "") for d in documents}
        missing = []
        if "TIMESHARE_CONTRACT" not in doc_types:
            missing.append(
                "CRITICAL: Original timeshare contract not uploaded. "
                "Contract analysis cannot be fully verified without it."
            )
        if "MAINTENANCE_FEE_STATEMENT" not in doc_types:
            missing.append(
                "Recommended: Upload most recent maintenance fee statement "
                "to support financial damages calculation."
            )
        if "RESORT_RESPONSE" not in doc_types:
            missing.append(
                "Recommended: Upload any written correspondence received from "
                "the resort to document their negotiating position."
            )
        return missing

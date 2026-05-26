from __future__ import annotations

"""
SendGrid email delivery of evidence packs.
Generates a 7-day presigned S3 URL and sends via the SendGrid API.
"""

import logging
from typing import Any

import boto3
import httpx
from botocore.config import Config

from app.config import get_settings

settings = get_settings()
log = logging.getLogger(__name__)

_TEMPLATE = """\
Subject: [ExitForge] Attorney Evidence Pack Ready — Case {case_id}

Dear Attorney,

An Attorney Evidence Pack for case {case_id} has been generated and is ready for review.

{personal_note_block}
Pack Summary:
- Strength Score: {strength_score}
- Page Count: {page_count}
- Generated: {generated_at}

Download the pack (link expires in 7 days):
{download_url}

This pack was prepared by ExitForge AI Legal Operations. All statute citations should 
be independently verified before reliance in any legal proceeding.

— ExitForge Legal Operations
"""


async def send_pack_email(
    s3_key: str,
    pack_id: str,
    case_id: str,
    attorney_email: str,
    personal_note: str | None,
    pack_metadata: dict[str, Any],
) -> None:
    """
    Generate a presigned S3 download URL and send via SendGrid.
    Raises on failure.
    """
    # Generate pre-signed URL
    s3 = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        config=Config(signature_version="s3v4"),
    )
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
        ExpiresIn=settings.presigned_url_expiry_seconds,
    )

    strength = pack_metadata.get("strength_score", 0.0)
    pages = pack_metadata.get("page_count", 0)
    generated_at = pack_metadata.get("generated_at", "")

    personal_note_block = ""
    if personal_note:
        personal_note_block = f"Note from case manager:\n{personal_note}\n\n"

    body = _TEMPLATE.format(
        case_id=case_id,
        personal_note_block=personal_note_block,
        strength_score=f"{strength * 100:.0f}%",
        page_count=pages,
        generated_at=generated_at,
        download_url=download_url,
    )

    payload = {
        "personalizations": [{"to": [{"email": attorney_email}]}],
        "from": {
            "email": settings.sendgrid_from_email,
            "name": settings.sendgrid_from_name,
        },
        "subject": f"[ExitForge] Attorney Evidence Pack Ready — Case {case_id}",
        "content": [{"type": "text/plain", "value": body}],
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code not in (200, 202):
            raise RuntimeError(
                f"SendGrid delivery failed: {resp.status_code} — {resp.text}"
            )

    log.info("evidence_pack_email_sent", pack_id=pack_id, attorney=attorney_email)

"""
AWS Textract OCR pipeline.

Starts a Textract asynchronous job, polls for completion,
and returns the full extracted text with page-level structure.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


def _textract_client() -> Any:
    return boto3.client(
        "textract",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )


async def extract_text_from_s3(s3_key: str) -> dict[str, Any]:
    """
    Runs Textract DetectDocumentText asynchronously (async job API for multi-page PDFs).
    Returns structured OCR result with per-page text blocks.
    """
    client = _textract_client()

    # Start async job
    try:
        response = await asyncio.to_thread(
            client.start_document_text_detection,
            DocumentLocation={
                "S3Object": {
                    "Bucket": settings.s3_bucket_name,
                    "Name": s3_key,
                }
            },
        )
        job_id: str = response["JobId"]
        log.info("Textract job started", extra={"job_id": job_id, "s3_key": s3_key})
    except ClientError as e:
        log.error("Textract start failed", extra={"error": str(e), "s3_key": s3_key})
        raise

    # Poll for completion (max 5 min)
    result = await _poll_textract_job(client, job_id)
    return _parse_textract_result(result)


@retry(stop=stop_after_attempt(30), wait=wait_exponential(multiplier=2, min=5, max=30))
async def _poll_textract_job(client: Any, job_id: str) -> list[dict[str, Any]]:
    """Polls until job is complete. Retries with backoff."""
    all_blocks: list[dict[str, Any]] = []
    next_token: str | None = None

    while True:
        kwargs: dict[str, Any] = {"JobId": job_id}
        if next_token:
            kwargs["NextToken"] = next_token

        response = await asyncio.to_thread(client.get_document_text_detection, **kwargs)
        status = response["JobStatus"]

        if status == "FAILED":
            raise RuntimeError(f"Textract job {job_id} failed: {response.get('StatusMessage')}")

        if status == "SUCCEEDED":
            all_blocks.extend(response.get("Blocks", []))
            next_token = response.get("NextToken")
            if not next_token:
                return all_blocks

        # Still IN_PROGRESS — raise to trigger retry
        raise Exception(f"Job {job_id} still in progress")


def _parse_textract_result(blocks: list[dict[str, Any]]) -> dict[str, Any]:
    """Organizes raw Textract blocks into page-keyed text."""
    pages: dict[int, list[str]] = {}

    for block in blocks:
        if block["BlockType"] == "LINE":
            page = block.get("Page", 1)
            pages.setdefault(page, []).append(block["Text"])

    full_text = "\n".join(
        line
        for page_num in sorted(pages)
        for line in pages[page_num]
    )

    return {
        "full_text": full_text,
        "page_count": len(pages),
        "pages": {str(k): "\n".join(v) for k, v in pages.items()},
        "word_count": len(full_text.split()),
    }

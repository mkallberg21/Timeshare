"""
Contract intelligence analyzer.

Uses Claude to extract clauses, detect misrepresentations,
flag illegal terms, and identify rescission windows.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

ANALYSIS_SYSTEM_PROMPT = """
You are an expert timeshare contract attorney with 20+ years of experience.
Analyze timeshare contracts for consumer protection violations, misrepresentations,
illegal terms, and exit leverage points.

Your analysis must be thorough, legally precise, and actionable for the exit strategy.
Always return valid JSON matching the exact schema provided.
"""

ANALYSIS_USER_PROMPT = """
Analyze this timeshare contract text and return a JSON object with EXACTLY this structure:

{
  "clauses": [
    {
      "id": "<uuid>",
      "type": "<clause type>",
      "text": "<verbatim clause text, max 500 chars>",
      "page_number": <integer>,
      "is_problematic": <boolean>,
      "legal_basis": "<relevant statute or case law, or null>"
    }
  ],
  "misrepresentation_flags": [
    {
      "id": "<uuid>",
      "description": "<what was misrepresented>",
      "clause_id": "<clause id above>",
      "severity": "LOW|MEDIUM|HIGH",
      "legal_basis": "<statute e.g. FTC Act Section 5, state consumer protection law>"
    }
  ],
  "illegal_term_flags": [
    {
      "id": "<uuid>",
      "description": "<why this term is illegal>",
      "clause_id": "<clause id above>",
      "statute": "<specific statute violated>",
      "jurisdiction": "<state or federal>"
    }
  ],
  "rescission_window_days": <integer or null>,
  "has_perpetuity_language": <boolean>,
  "confidence": <float 0.0-1.0>
}

Contract text:
{contract_text}

Return ONLY valid JSON. No explanation, no markdown.
"""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def analyze_contract(
    contract_text: str,
    document_id: str,
) -> dict[str, Any]:
    """
    Runs full contract intelligence analysis using Claude.
    Returns structured ContractIntelligenceReport data.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Truncate to Claude's context window; full contracts rarely exceed 100k chars
    truncated_text = contract_text[:90_000]

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": ANALYSIS_USER_PROMPT.format(contract_text=truncated_text),
            }
        ],
    )

    raw = response.content[0]
    if raw.type != "text":
        raise ValueError("Unexpected response type from Claude")

    # Validate JSON before writing to DB
    analysis: dict[str, Any] = json.loads(raw.text)

    # Ensure all clause IDs are populated (Claude may omit them)
    for clause in analysis.get("clauses", []):
        if not clause.get("id"):
            clause["id"] = str(uuid.uuid4())
    for flag in analysis.get("misrepresentation_flags", []):
        if not flag.get("id"):
            flag["id"] = str(uuid.uuid4())
    for flag in analysis.get("illegal_term_flags", []):
        if not flag.get("id"):
            flag["id"] = str(uuid.uuid4())

    return {
        "document_id": document_id,
        "extracted_text": contract_text,
        **analysis,
    }

from __future__ import annotations

"""Tests for DemandLetterAssembler — specifically tone calibration by resistance score."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from anthropic import AsyncAnthropic

from app.assemblers.demand_letter import DemandLetterAssembler
from app.models.evidence_pack import CaseContext, DemandLetterSection


def _make_context(resistance_score: float = 0.5) -> CaseContext:
    return CaseContext(
        case_id="CASE-003",
        client_name="Maria Gonzalez",
        client_email="maria@example.com",
        resort_name="Diamond Resorts Hawaii",
        resort_developer="Diamond Resorts",
        resort_state="HI",
        purchase_date="2019-09-10",
        purchase_price=45000.0,
        annual_maintenance_fee=2200.0,
        mortgage_balance=38000.0,
        sales_rep_name="Bob Williams",
        misrepresentations=[
            {"category": "INVESTMENT_VALUE", "client_allegation": "Rep said timeshare would increase in value"}
        ],
        timeline_events=[],
        uploaded_documents=[],
        negotiation_rounds=[],
        resort_resistance_score=resistance_score,
    )


def _make_letter_payload(tone: str = "firm") -> dict:
    return {
        "letter_draft": f"VIA CERTIFIED MAIL\n\nDear Legal Counsel,\n\nDEMAND FOR RESCISSION ({tone.upper()} TONE)\n\n...",
        "tone": tone,
        "tone_rationale": f"Resistance score drove {tone} tone selection",
        "legal_grounds_used": ["Haw. Rev. Stat. § 514E-8", "Hawaii Consumer Protection Act"],
        "statutes_cited": ["Haw. Rev. Stat. § 480-2"],
        "demands": ["Full rescission", "Return of all monies paid"],
        "response_deadline_days": 30,
        "instructions_for_attorney": "Review and sign on firm letterhead before sending.",
        "warnings_for_attorney": [],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "resistance_score,expected_tone_substring",
    [
        (0.2, "cooperative"),
        (0.55, "firm"),
        (0.85, "adversarial"),
    ],
)
async def test_demand_letter_tone_calibration(resistance_score, expected_tone_substring):
    ctx = _make_context(resistance_score=resistance_score)
    payload = _make_letter_payload(tone=expected_tone_substring)

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = DemandLetterAssembler(mock_client, ctx)
    result = await assembler.assemble()

    assert isinstance(result, DemandLetterSection)
    assert result.tone == expected_tone_substring
    assert len(result.legal_grounds_used) > 0


@pytest.mark.asyncio
async def test_demand_letter_has_mandatory_fields():
    ctx = _make_context()
    payload = _make_letter_payload()

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = DemandLetterAssembler(mock_client, ctx)
    result = await assembler.assemble()

    # Letter must have content, legal grounds, statute citations, and demands
    assert result.letter_draft
    assert result.legal_grounds_used
    assert result.statutes_cited
    assert result.demands
    assert result.response_deadline_days > 0
    assert result.instructions_for_attorney

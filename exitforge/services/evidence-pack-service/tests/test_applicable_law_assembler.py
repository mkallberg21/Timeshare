from __future__ import annotations

"""Tests for ApplicableLawAssembler — SOL calculation and statute injection."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from anthropic import AsyncAnthropic

from app.assemblers.applicable_law import ApplicableLawAssembler
from app.models.evidence_pack import CaseContext, ApplicableLawSection


def _make_context(purchase_date: str = "2018-06-15", state: str = "FL") -> CaseContext:
    return CaseContext(
        case_id="CASE-004",
        client_name="Patricia Williams",
        client_email="pat@example.com",
        resort_name="Westgate Vacation Villas",
        resort_developer="Westgate Resorts",
        resort_state=state,
        purchase_date=purchase_date,
        purchase_price=28000.0,
        annual_maintenance_fee=1300.0,
        mortgage_balance=20000.0,
        sales_rep_name="Steve Park",
        misrepresentations=[],
        timeline_events=[],
        uploaded_documents=[],
        negotiation_rounds=[],
    )


def _make_law_payload(state: str = "FL") -> dict:
    return {
        "jurisdiction": state,
        "primary_statutes": [
            {
                "name": "Florida Vacation Plan and Timesharing Act",
                "citation": "Fla. Stat. §§ 721.01–721.26",
                "how_it_applies": "§ 721.10 grants purchaser 10-day right to cancel",
                "is_violated": True,
                "remedies_available": ["Rescission", "Actual damages", "Attorney fees"],
            }
        ],
        "federal_law": [
            {
                "name": "FTC Act — Section 5",
                "citation": "15 U.S.C. § 45",
                "how_it_applies": "High-pressure tactics constitute unfair practice",
            }
        ],
        "statute_of_limitations_analysis": {
            "purchase_date": "2018-06-15",
            "state_sol": 5,
            "sol_expiry_date": "2023-06-15",
            "is_within_sol": False,
            "tollable_event_exists": True,
            "tollable_event_description": "Developer concealed rescission rights; discovery rule tolls SOL to date client discovered fraud",
            "urgency_note": "SOL has technically expired — strong tolling argument required",
        },
        "jurisdictional_notes": "Florida courts favor consumers in timeshare cases when rescission rights were concealed.",
    }


@pytest.mark.asyncio
async def test_applicable_law_returns_valid_model():
    ctx = _make_context()
    payload = _make_law_payload()

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = ApplicableLawAssembler(mock_client, ctx)
    result = await assembler.assemble()

    assert isinstance(result, ApplicableLawSection)
    assert result.jurisdiction == "FL"
    assert len(result.primary_statutes) >= 1
    assert result.statute_of_limitations_analysis.state_sol == 5


@pytest.mark.asyncio
async def test_applicable_law_tollable_event_flagged():
    ctx = _make_context()
    payload = _make_law_payload()
    payload["statute_of_limitations_analysis"]["tollable_event_exists"] = True

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = ApplicableLawAssembler(mock_client, ctx)
    result = await assembler.assemble()

    assert result.statute_of_limitations_analysis.tollable_event_exists is True
    assert result.statute_of_limitations_analysis.tollable_event_description is not None


@pytest.mark.asyncio
async def test_applicable_law_nevada_state():
    """Verify Nevada (NV) statutes are injected into the prompt correctly."""
    ctx = _make_context(state="NV")
    payload = _make_law_payload(state="NV")
    payload["primary_statutes"][0]["name"] = "Nevada Timeshare Act"
    payload["primary_statutes"][0]["citation"] = "Nev. Rev. Stat. §§ 119A.010–119A.650"

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()

    captured_prompts = []
    async def capture_and_return(*args, **kwargs):
        captured_prompts.append(kwargs.get("messages", []))
        return msg

    mock_client.messages.create = capture_and_return

    assembler = ApplicableLawAssembler(mock_client, ctx)
    result = await assembler.assemble()

    # The prompt should mention NV statute details
    full_prompt_text = str(captured_prompts)
    assert "119A" in full_prompt_text or "Nevada" in full_prompt_text

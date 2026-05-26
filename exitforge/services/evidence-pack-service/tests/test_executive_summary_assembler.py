from __future__ import annotations

"""Tests for ExecutiveSummaryAssembler."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic import AsyncAnthropic

from app.assemblers.executive_summary import ExecutiveSummaryAssembler
from app.models.evidence_pack import CaseContext, ExecutiveSummary


def _make_context() -> CaseContext:
    return CaseContext(
        case_id="CASE-001",
        client_name="Jane Doe",
        client_email="jane@example.com",
        resort_name="Grandview Las Vegas",
        resort_developer="Wyndham Destinations",
        resort_state="NV",
        purchase_date="2018-06-15",
        purchase_price=25000.0,
        annual_maintenance_fee=1200.0,
        mortgage_balance=18000.0,
        sales_rep_name="John Smith",
        misrepresentations=[
            {"category": "RENTAL_INCOME", "client_allegation": "Rep promised $500/month rental income"},
        ],
        timeline_events=[],
        uploaded_documents=[],
        negotiation_rounds=[],
    )


def _make_mock_response(summary_dict: dict) -> MagicMock:
    content_block = MagicMock()
    content_block.text = json.dumps(summary_dict)
    msg = MagicMock()
    msg.content = [content_block]
    return msg


@pytest.mark.asyncio
async def test_executive_summary_returns_valid_model():
    ctx = _make_context()
    expected = {
        "case_strength_rating": "STRONG",
        "strength_score": 0.82,
        "one_page_narrative": "Strong case based on rental income misrepresentation.",
        "primary_legal_grounds": ["Misrepresentation under NRS § 119A", "DTPA violation"],
        "recommended_immediate_action": "Send demand letter within 14 days",
        "client_full_name": "Jane Doe",
        "resort_name": "Grandview Las Vegas",
        "resort_developer": "Wyndham Destinations",
        "purchase_price": 25000.0,
        "outstanding_mortgage": 18000.0,
        "current_maintenance_fee_annual": 1200.0,
        "total_financial_exposure": 63600.0,
        "key_deadlines": [],
    }
    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=_make_mock_response(expected))

    assembler = ExecutiveSummaryAssembler(mock_client, ctx)
    result = await assembler.assemble()

    assert isinstance(result, ExecutiveSummary)
    assert result.case_strength_rating == "STRONG"
    assert result.strength_score == pytest.approx(0.82)
    assert result.client_full_name == "Jane Doe"


@pytest.mark.asyncio
async def test_executive_summary_strips_markdown_fences():
    ctx = _make_context()
    expected = {
        "case_strength_rating": "MODERATE",
        "strength_score": 0.55,
        "one_page_narrative": "Moderate case.",
        "primary_legal_grounds": ["Consumer fraud"],
        "recommended_immediate_action": "File CFPB complaint",
        "client_full_name": "Jane Doe",
        "resort_name": "Grandview Las Vegas",
        "resort_developer": "Wyndham Destinations",
        "purchase_price": 25000.0,
        "outstanding_mortgage": 18000.0,
        "current_maintenance_fee_annual": 1200.0,
        "total_financial_exposure": 50000.0,
        "key_deadlines": [],
    }
    # Wrap in markdown fences — assembler must strip these
    raw = f"```json\n{json.dumps(expected)}\n```"
    content_block = MagicMock()
    content_block.text = raw
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = ExecutiveSummaryAssembler(mock_client, ctx)
    result = await assembler.assemble()

    assert result.case_strength_rating == "MODERATE"


@pytest.mark.asyncio
async def test_executive_summary_raises_on_invalid_json():
    ctx = _make_context()
    content_block = MagicMock()
    content_block.text = "NOT VALID JSON AT ALL"
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = ExecutiveSummaryAssembler(mock_client, ctx)
    with pytest.raises(ValueError):
        await assembler.assemble()

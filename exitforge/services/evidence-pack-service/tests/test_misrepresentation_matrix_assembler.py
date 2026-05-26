from __future__ import annotations

"""Tests for MisrepresentationMatrixAssembler."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from anthropic import AsyncAnthropic

from app.assemblers.misrepresentation_matrix import MisrepresentationMatrixAssembler
from app.models.evidence_pack import CaseContext, MisrepresentationMatrix, MisrepresentationEntry


def _make_context() -> CaseContext:
    return CaseContext(
        case_id="CASE-002",
        client_name="Robert Torres",
        client_email="robert@example.com",
        resort_name="Westgate Myrtle Beach",
        resort_developer="Westgate Resorts",
        resort_state="SC",
        purchase_date="2020-03-01",
        purchase_price=32000.0,
        annual_maintenance_fee=1500.0,
        mortgage_balance=27000.0,
        sales_rep_name="Alice Johnson",
        misrepresentations=[
            {
                "category": "RENTAL_INCOME",
                "client_allegation": "Sales rep guaranteed $800/month in rental income to offset maintenance fees",
            },
            {
                "category": "MAINTENANCE_FEE_CAP",
                "client_allegation": "Rep said maintenance fees would never exceed $1,200/year",
            },
            {
                "category": "PERPETUITY_CONCEALMENT",
                "client_allegation": "Was not told obligation is perpetual and transfers to heirs",
            },
        ],
        timeline_events=[],
        uploaded_documents=[],
        negotiation_rounds=[],
    )


def _make_mock_matrix() -> dict:
    return {
        "total_misrepresentations_found": 3,
        "overall_misrepresentation_score": 0.87,
        "prosecutorial_narrative": "Three independent and well-documented misrepresentations create a very strong case.",
        "entries": [
            {
                "id": "M1",
                "category": "RENTAL_INCOME",
                "client_allegation": "Sales rep guaranteed $800/month in rental income",
                "contract_contradiction": "Contract § 12.3 states no rental guarantee is provided",
                "contract_page_citation": "Page 14, § 12.3",
                "applicable_statutes": ["S.C. Code Ann. § 27-32-170"],
                "precedent_cases": None,
                "settlement_leverage": "HIGH",
                "why_actionable": "Oral guarantee contradicts written contract terms — classic misrepresentation",
                "documentary_evidence": "Signed contract § 12.3",
            },
            {
                "id": "M2",
                "category": "MAINTENANCE_FEE_CAP",
                "client_allegation": "Rep said fees would never exceed $1,200/year",
                "contract_contradiction": "Contract § 8.1 allows unlimited annual increases",
                "contract_page_citation": "Page 9, § 8.1",
                "applicable_statutes": ["S.C. Code Ann. § 39-5-20"],
                "precedent_cases": None,
                "settlement_leverage": "HIGH",
                "why_actionable": "No fee cap in contract; fees already at $1,500",
                "documentary_evidence": "Contract § 8.1 vs maintenance fee history",
            },
            {
                "id": "M3",
                "category": "PERPETUITY_CONCEALMENT",
                "client_allegation": "Was not told obligation transfers to heirs",
                "contract_contradiction": "Contract § 3.2 states timeshare is heritable",
                "contract_page_citation": "Page 4, § 3.2",
                "applicable_statutes": ["S.C. Code Ann. § 27-32-170"],
                "precedent_cases": None,
                "settlement_leverage": "MEDIUM",
                "why_actionable": "Failure to disclose perpetual nature is actionable omission",
                "documentary_evidence": "Contract § 3.2",
            },
        ],
    }


@pytest.mark.asyncio
async def test_misrepresentation_matrix_returns_valid_model():
    ctx = _make_context()
    payload = _make_mock_matrix()

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = MisrepresentationMatrixAssembler(mock_client, ctx)
    result = await assembler.assemble()

    assert isinstance(result, MisrepresentationMatrix)
    assert result.total_misrepresentations_found == 3
    assert result.overall_misrepresentation_score == pytest.approx(0.87)
    assert len(result.entries) == 3
    assert result.entries[0].settlement_leverage == "HIGH"


@pytest.mark.asyncio
async def test_misrepresentation_matrix_no_null_precedent_cases():
    """Verify null precedent_cases from Claude is accepted (should not fabricate cases)."""
    ctx = _make_context()
    payload = _make_mock_matrix()
    # All entries have precedent_cases=None — this must be allowed
    for e in payload["entries"]:
        e["precedent_cases"] = None

    content_block = MagicMock()
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]

    mock_client = AsyncMock(spec=AsyncAnthropic)
    mock_client.messages = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    assembler = MisrepresentationMatrixAssembler(mock_client, ctx)
    result = await assembler.assemble()

    for entry in result.entries:
        assert entry.precedent_cases is None

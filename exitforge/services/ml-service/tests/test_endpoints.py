"""
Tests for ml-service FastAPI endpoints.
Covers qualification, strategy, and timeline prediction endpoints.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport


# We need to import the app without model files
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Patch model loading to return None (rules-based fallback)
import unittest.mock as mock
with mock.patch("joblib.load", side_effect=Exception("no model")):
    from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ─── Qualification ────────────────────────────────────────────────────────────

class TestQualificationEndpoint:
    @pytest.mark.asyncio
    async def test_eligible_case_high_misrepresentation(self, client: AsyncClient):
        """High misrepresentation count → score pushes above 0.65 threshold."""
        resp = await client.post("/predict/qualification", json={
            "resort_name": "Sunset Palms",
            "resort_state": "FL",
            "contract_year": 2010,
            "purchase_price": 25000,
            "maintenance_fee_annual": 2000,
            "outstanding_mortgage": 10000,
            "misrepresentation_count": 4,
            "financial_hardship": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["eligible"] is True
        assert 0.0 <= data["score"] <= 1.0
        assert data["estimated_recovery_low"] > 0
        assert data["recommended_track"] in {
            "DEED_BACK", "LEGAL_DEMAND", "REGULATORY_PRESSURE", "LITIGATION"
        }

    @pytest.mark.asyncio
    async def test_ineligible_case_low_score(self, client: AsyncClient):
        """Minimal issues → rules-based score below 0.65."""
        resp = await client.post("/predict/qualification", json={
            "resort_name": "Generic Resort",
            "resort_state": "NV",
            "contract_year": 2022,
            "purchase_price": 8000,
            "maintenance_fee_annual": 600,
            "outstanding_mortgage": 0,
            "misrepresentation_count": 0,
            "financial_hardship": False,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["eligible"] is False

    @pytest.mark.asyncio
    async def test_response_schema_complete(self, client: AsyncClient):
        """Response contains all required fields."""
        resp = await client.post("/predict/qualification", json={
            "resort_name": "Test",
            "purchase_price": 20000,
            "maintenance_fee_annual": 1800,
            "outstanding_mortgage": 8000,
            "misrepresentation_count": 2,
            "financial_hardship": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        required = {"score", "eligible", "estimated_recovery_low",
                    "estimated_recovery_high", "recommended_track", "explanation"}
        assert required.issubset(data.keys())

    @pytest.mark.asyncio
    async def test_missing_required_fields_returns_422(self, client: AsyncClient):
        resp = await client.post("/predict/qualification", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_misrepresentation_count_rejected(self, client: AsyncClient):
        resp = await client.post("/predict/qualification", json={
            "resort_name": "Test",
            "purchase_price": 20000,
            "maintenance_fee_annual": 1800,
            "outstanding_mortgage": 0,
            "misrepresentation_count": -1,
            "financial_hardship": False,
        })
        assert resp.status_code == 422


# ─── Strategy ─────────────────────────────────────────────────────────────────

class TestStrategyEndpoint:
    @pytest.mark.asyncio
    async def test_regulatory_pressure_for_high_misrepresentation(self, client: AsyncClient):
        resp = await client.post("/predict/strategy", json={
            "qualification_score": 0.85,
            "contract_report": {
                "misrepresentation_flags": ["flag1", "flag2", "flag3"],
                "illegal_term_flags": ["term1", "term2"],
                "has_perpetuity_language": True,
            },
            "resort_intelligence": {
                "resistance_score": 0.6,
                "deed_back_available": False,
            },
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["primary_track"] == "REGULATORY_PRESSURE"
        assert 0.0 < data["confidence"] <= 1.0

    @pytest.mark.asyncio
    async def test_deed_back_for_low_resistance_cooperative_resort(self, client: AsyncClient):
        resp = await client.post("/predict/strategy", json={
            "qualification_score": 0.70,
            "contract_report": {
                "misrepresentation_flags": [],
                "illegal_term_flags": [],
                "has_perpetuity_language": False,
            },
            "resort_intelligence": {
                "resistance_score": 0.3,
                "deed_back_available": True,
            },
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["primary_track"] == "DEED_BACK"

    @pytest.mark.asyncio
    async def test_response_has_rationale(self, client: AsyncClient):
        resp = await client.post("/predict/strategy", json={
            "qualification_score": 0.75,
            "contract_report": {},
            "resort_intelligence": {},
        })
        assert resp.status_code == 200
        assert len(resp.json()["rationale"]) > 0


# ─── Timeline ─────────────────────────────────────────────────────────────────

class TestTimelineEndpoint:
    @pytest.mark.asyncio
    async def test_deed_back_baseline(self, client: AsyncClient):
        resp = await client.post("/predict/timeline", json={
            "case_id": "case_123",
            "exit_track": "DEED_BACK",
            "resort_resistance_score": 0.5,
            "negotiation_round": 1,
        })
        assert resp.status_code == 200
        data = resp.json()
        # P50 baseline for DEED_BACK is 90 days at resistance 0.5
        assert data["p50_days"] == 90
        assert data["p90_days"] == 150
        assert data["current_stage_days_remaining"] >= 0

    @pytest.mark.asyncio
    async def test_high_resistance_increases_timeline(self, client: AsyncClient):
        low_resp = await client.post("/predict/timeline", json={
            "case_id": "case_1",
            "exit_track": "DEED_BACK",
            "resort_resistance_score": 0.1,
            "negotiation_round": 1,
        })
        high_resp = await client.post("/predict/timeline", json={
            "case_id": "case_2",
            "exit_track": "DEED_BACK",
            "resort_resistance_score": 0.9,
            "negotiation_round": 1,
        })
        assert low_resp.json()["p50_days"] < high_resp.json()["p50_days"]

    @pytest.mark.asyncio
    async def test_litigation_is_longest_track(self, client: AsyncClient):
        litigation = await client.post("/predict/timeline", json={
            "case_id": "case_lit",
            "exit_track": "LITIGATION",
            "resort_resistance_score": 0.5,
            "negotiation_round": 1,
        })
        deed_back = await client.post("/predict/timeline", json={
            "case_id": "case_deed",
            "exit_track": "DEED_BACK",
            "resort_resistance_score": 0.5,
            "negotiation_round": 1,
        })
        assert litigation.json()["p50_days"] > deed_back.json()["p50_days"]

    @pytest.mark.asyncio
    async def test_later_negotiation_round_adds_days(self, client: AsyncClient):
        round1 = await client.post("/predict/timeline", json={
            "case_id": "c1", "exit_track": "LEGAL_DEMAND",
            "resort_resistance_score": 0.5, "negotiation_round": 1,
        })
        round3 = await client.post("/predict/timeline", json={
            "case_id": "c2", "exit_track": "LEGAL_DEMAND",
            "resort_resistance_score": 0.5, "negotiation_round": 3,
        })
        assert round3.json()["p50_days"] > round1.json()["p50_days"]

    @pytest.mark.asyncio
    async def test_invalid_resistance_score_rejected(self, client: AsyncClient):
        resp = await client.post("/predict/timeline", json={
            "case_id": "c1", "exit_track": "DEED_BACK",
            "resort_resistance_score": 1.5,  # > 1.0
            "negotiation_round": 1,
        })
        assert resp.status_code == 422


# ─── Health ───────────────────────────────────────────────────────────────────

class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

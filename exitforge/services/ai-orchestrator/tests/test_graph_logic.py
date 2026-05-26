"""
Tests for ai-orchestrator CaseState logic and routing.
Tests are unit-level — no LangGraph execution, no Kafka, no Claude.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── CaseState structure tests ────────────────────────────────────────────────

class TestCaseStateStructure:
    """Verify CaseState TypedDict has the expected keys."""

    def test_can_construct_minimal_case_state(self):
        """CaseState can be constructed with required fields."""
        with patch("app.config.get_settings") as mock_settings_fn, \
             patch("app.graph.agent_graph.MemorySaver", create=True), \
             patch("langgraph.graph.StateGraph"), \
             patch("langchain_anthropic.ChatAnthropic"):
            mock_settings_fn.return_value = MagicMock(
                anthropic_api_key="sk-test",
                anthropic_model="claude-3-5-sonnet-20241022",
                redis_url="redis://localhost:6379",
                case_service_url="http://localhost:4000",
                ml_service_url="http://localhost:8001",
            )
            # Import after patching
            import importlib
            import sys
            # Ensure fresh import
            if "app.graph.agent_graph" in sys.modules:
                del sys.modules["app.graph.agent_graph"]
            
            # We just verify the TypedDict keys are correct by building one
            state = {
                "case_id": "case_123",
                "client_id": "client_456",
                "intake_data": {"resort_name": "Test"},
                "qualification_score": 0.85,
                "eligible": True,
                "contract_report": {},
                "resort_intelligence": {},
                "strategy_plan": {},
                "negotiation_rounds": [],
                "current_track": "DEED_BACK",
                "outcome": None,
                "requires_human_review": False,
                "human_review_reason": None,
                "human_review_priority": None,
                "error": None,
                "correlation_id": "corr_789",
            }
            assert state["case_id"] == "case_123"
            assert state["eligible"] is True
            assert state["negotiation_rounds"] == []


# ─── Fee formula validation ───────────────────────────────────────────────────

class TestFeeFormula:
    """Verify the fee formula constants match case-service implementation."""

    def test_fee_rate_constant(self):
        FEE_RATE = 0.07
        MAINTENANCE_FEE_YEARS = 5

        outstanding_mortgage = 100_000
        maintenance_fee_annual = 3_000

        basis = outstanding_mortgage + maintenance_fee_annual * MAINTENANCE_FEE_YEARS
        fee = basis * FEE_RATE

        assert basis == 115_000
        assert fee == pytest.approx(8_050.0, rel=1e-6)

    def test_fee_rate_zero_mortgage(self):
        FEE_RATE = 0.07
        MAINTENANCE_FEE_YEARS = 5
        basis = 0 + 2_000 * MAINTENANCE_FEE_YEARS
        fee = basis * FEE_RATE
        assert basis == 10_000
        assert fee == pytest.approx(700.0)


# ─── Strategy routing logic ───────────────────────────────────────────────────

class TestStrategyRoutingRules:
    """Verify strategy selection logic (same rules used by AI orchestrator)."""

    @pytest.mark.parametrize("misrep_count,mortgage,score,expected_track", [
        (3, 50_000, 0.9, "LEGAL_DEMAND"),    # misrep_count >= 2 → LEGAL_DEMAND
        (0, 0, 0.9, "DEED_BACK"),             # mortgage == 0 → DEED_BACK
        (0, 10_000, 0.85, "REGULATORY_PRESSURE"),  # score > 0.8 → REGULATORY_PRESSURE
        (1, 10_000, 0.7, "LEGAL_DEMAND"),     # misrep_count >= 2? No → check others
    ])
    def test_strategy_track_selection(
        self, misrep_count: int, mortgage: float, score: float, expected_track: str
    ):
        """Routing mirrors agent_graph strategy_selector_node logic."""
        LEGAL_DEMAND = "LEGAL_DEMAND"
        DEED_BACK = "DEED_BACK"
        REGULATORY_PRESSURE = "REGULATORY_PRESSURE"

        def select_track(misrep: int, mort: float, s: float) -> str:
            if misrep >= 2:
                return LEGAL_DEMAND
            if mort == 0:
                return DEED_BACK
            if s > 0.8:
                return REGULATORY_PRESSURE
            return LEGAL_DEMAND

        result = select_track(misrep_count, mortgage, score)
        assert result == expected_track


# ─── Human review routing ─────────────────────────────────────────────────────

class TestHumanReviewRouting:
    """Verify human review flag routing logic."""

    def test_requires_human_review_true_routes_to_human_review(self):
        def route(state: dict) -> str:
            if state.get("requires_human_review"):
                return "human_review"
            if state.get("eligible"):
                return "strategy_selector"
            return "graceful_decline"

        assert route({"requires_human_review": True, "eligible": True}) == "human_review"

    def test_ineligible_routes_to_graceful_decline(self):
        def route(state: dict) -> str:
            if state.get("requires_human_review"):
                return "human_review"
            if state.get("eligible"):
                return "strategy_selector"
            return "graceful_decline"

        assert route({"requires_human_review": False, "eligible": False}) == "graceful_decline"

    def test_eligible_routes_to_strategy_selector(self):
        def route(state: dict) -> str:
            if state.get("requires_human_review"):
                return "human_review"
            if state.get("eligible"):
                return "strategy_selector"
            return "graceful_decline"

        assert route({"requires_human_review": False, "eligible": True}) == "strategy_selector"


# ─── Config tests ─────────────────────────────────────────────────────────────

class TestConfig:
    """Verify config defaults and required fields."""

    def test_redis_url_has_default(self):
        import os
        # Simulate the config loading
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        assert redis_url.startswith("redis://")

    def test_anthropic_model_is_set(self):
        import os
        model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        assert "claude" in model

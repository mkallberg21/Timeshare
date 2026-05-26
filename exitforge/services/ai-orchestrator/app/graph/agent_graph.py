"""
LangGraph agent graph — the autonomous AI engine for ExitForge.

Each node is a pure async function that receives CaseState and returns
a partial state update. The graph orchestrates the full case lifecycle
from intake through outcome, with automatic checkpointing for resumability.
"""
from __future__ import annotations

import json
import logging
from typing import Annotated, Any
import operator

import httpx
from langgraph.graph import StateGraph, END
try:
    from langgraph.checkpoint.redis import RedisSaver
    _REDIS_SAVER_AVAILABLE = True
except ImportError:  # pragma: no cover — fallback for local dev without Redis
    from langgraph.checkpoint.memory import MemorySaver as RedisSaver  # type: ignore[assignment]
    _REDIS_SAVER_AVAILABLE = False
from typing_extensions import TypedDict

from app.config import get_settings
from app.llm.claude_client import get_claude_client

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── State Definition ─────────────────────────────────────────────────────────

class CaseState(TypedDict):
    case_id: str
    client_id: str
    intake_data: dict[str, Any]
    qualification_score: float | None
    eligible: bool | None
    contract_report: dict[str, Any] | None
    resort_intelligence: dict[str, Any] | None
    strategy_plan: dict[str, Any] | None
    # Annotated with operator.add so each node can append rounds without overwriting
    negotiation_rounds: Annotated[list[dict[str, Any]], operator.add]
    current_track: str | None
    outcome: dict[str, Any] | None
    requires_human_review: bool
    human_review_reason: str | None
    human_review_priority: str | None
    error: str | None
    correlation_id: str


# ─── Node: Intake Analyzer ────────────────────────────────────────────────────

async def intake_analyzer_node(state: CaseState) -> dict[str, Any]:
    """
    Uses Claude to extract structured case context from raw intake submission.
    Validates required fields and flags incomplete data for human review.
    """
    client = get_claude_client()

    prompt = f"""
Extract structured information from this timeshare intake submission.
Return ONLY a valid JSON object with these exact keys.
If a field cannot be confidently extracted, use null.

Intake data:
{json.dumps(state["intake_data"], indent=2)}

Required JSON schema:
{{
  "resort_name": string | null,
  "resort_state": string | null,
  "contract_year": integer | null,
  "purchase_price": float | null,
  "maintenance_fee_annual": float | null,
  "outstanding_mortgage": float,
  "misrepresentation_claims": string[],
  "client_financial_hardship": boolean,
  "years_owned": integer | null
}}

Return ONLY valid JSON. No explanation, no markdown fences.
"""

    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        extracted: dict[str, Any] = json.loads(response.content[0].text)  # type: ignore[union-attr]
    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        logger.error("intake_analyzer: Claude returned non-JSON response: %s", e)
        return {
            **state,
            "requires_human_review": True,
            "human_review_reason": "AI failed to parse intake data — manual review required",
            "human_review_priority": "HIGH",
        }

    critical_fields = ["resort_name", "purchase_price", "maintenance_fee_annual"]
    missing = [f for f in critical_fields if not extracted.get(f)]

    if missing:
        return {
            **state,
            "requires_human_review": True,
            "human_review_reason": f"Could not extract critical fields: {missing}",
            "human_review_priority": "MEDIUM",
        }

    return {
        **state,
        "intake_data": {**state["intake_data"], "extracted": extracted},
    }


# ─── Node: Qualification Scorer ───────────────────────────────────────────────

async def qualification_scorer_node(state: CaseState) -> dict[str, Any]:
    """
    Calls ML service to score case eligibility.
    score >= 0.65 → eligible | 0.50–0.65 → human review | < 0.50 → decline
    """
    extracted: dict[str, Any] = state["intake_data"].get("extracted", {})

    payload = {
        "resort_name": extracted.get("resort_name"),
        "resort_state": extracted.get("resort_state"),
        "contract_year": extracted.get("contract_year"),
        "purchase_price": extracted.get("purchase_price", 0),
        "maintenance_fee_annual": extracted.get("maintenance_fee_annual", 0),
        "outstanding_mortgage": extracted.get("outstanding_mortgage", 0),
        "misrepresentation_count": len(extracted.get("misrepresentation_claims", [])),
        "financial_hardship": extracted.get("client_financial_hardship", False),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            response = await http.post(
                f"{settings.ml_service_url}/predict/qualification",
                json=payload,
            )
            response.raise_for_status()
            result: dict[str, Any] = response.json()
    except httpx.HTTPError as e:
        logger.error("qualification_scorer: ML service error: %s", e)
        # Fail safe — route to human review rather than silently failing
        return {
            **state,
            "requires_human_review": True,
            "human_review_reason": "ML qualification service unavailable",
            "human_review_priority": "URGENT",
        }

    score: float = float(result.get("score", 0))

    # 0.50–0.65: ambiguous — send to human
    if 0.50 <= score < 0.65:
        return {
            **state,
            "qualification_score": score,
            "eligible": False,
            "requires_human_review": True,
            "human_review_reason": f"Borderline qualification score: {score:.3f}",
            "human_review_priority": "MEDIUM",
        }

    return {
        **state,
        "qualification_score": score,
        "eligible": score >= 0.65,
    }


# ─── Node: Contract Analyzer ──────────────────────────────────────────────────

async def contract_analyzer_node(state: CaseState) -> dict[str, Any]:
    """
    Runs the full contract intelligence pipeline via document-service:
    Textract OCR → clause extraction → misrepresentation detection → legal term flagging.
    """
    try:
        async with httpx.AsyncClient(timeout=120.0) as http:
            response = await http.post(
                f"{settings.document_service_url}/analyze/contract",
                json={"case_id": state["case_id"]},
            )
            response.raise_for_status()
            contract_report: dict[str, Any] = response.json()
    except httpx.HTTPError as e:
        logger.error("contract_analyzer: document-service error: %s", e)
        return {
            **state,
            "requires_human_review": True,
            "human_review_reason": "Document analysis service unavailable",
            "human_review_priority": "HIGH",
        }

    return {**state, "contract_report": contract_report}


# ─── Node: Strategy Selector ──────────────────────────────────────────────────

async def strategy_selector_node(state: CaseState) -> dict[str, Any]:
    """
    Combines resort intelligence + ML model to select the optimal exit track.
    Primary tracks: DEED_BACK, LEGAL_DEMAND, REGULATORY_PRESSURE, LITIGATION
    """
    extracted: dict[str, Any] = state["intake_data"].get("extracted", {})

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resort_resp = await http.post(
                f"{settings.resort_intelligence_url}/score",
                json={"resort_name": extracted.get("resort_name", "")},
            )
            resort_resp.raise_for_status()
            resort_intel: dict[str, Any] = resort_resp.json()

            strategy_resp = await http.post(
                f"{settings.ml_service_url}/predict/strategy",
                json={
                    "qualification_score": state["qualification_score"],
                    "contract_report": state["contract_report"],
                    "resort_intelligence": resort_intel,
                },
            )
            strategy_resp.raise_for_status()
            strategy: dict[str, Any] = strategy_resp.json()

    except httpx.HTTPError as e:
        logger.error("strategy_selector: service error: %s", e)
        return {
            **state,
            "requires_human_review": True,
            "human_review_reason": "Strategy selection service unavailable",
            "human_review_priority": "HIGH",
        }

    return {
        **state,
        "resort_intelligence": resort_intel,
        "strategy_plan": strategy,
        "current_track": strategy.get("primary_track", "DEED_BACK"),
    }


# ─── Node: Negotiation Orchestrator ──────────────────────────────────────────

async def negotiation_orchestrator_node(state: CaseState) -> dict[str, Any]:
    """
    Generates a legally appropriate demand letter for the current track and round,
    queues it for attorney review (4-hour SLA), and records the round.
    """
    client = get_claude_client()
    round_num = len(state["negotiation_rounds"]) + 1
    extracted: dict[str, Any] = state["intake_data"].get("extracted", {})
    contract_report: dict[str, Any] = state.get("contract_report") or {}
    resort_intel: dict[str, Any] = state.get("resort_intelligence") or {}

    resistance = float(resort_intel.get("resistance_score", 0.5))
    tone = "firm and assertive" if resistance > 0.7 else "professional and cooperative"

    letter_prompt = f"""You are a licensed attorney specializing in timeshare law.
Write a formal timeshare exit demand letter for the following case.

Track: {state["current_track"]}
Round: {round_num}
Resort: {extracted.get("resort_name", "Unknown Resort")}
Contract issues identified:
{json.dumps(contract_report.get("misrepresentation_flags", []), indent=2)}
Resort resistance score: {resistance:.2f}
Tone: {tone}

The letter must include:
1. Client's full legal name (placeholder: [CLIENT_FULL_NAME])
2. Contract/deed reference number (placeholder: [CONTRACT_NUMBER])
3. Specific grounds for exit with legal citations
4. Each misrepresentation or illegal term found in contract analysis
5. Specific action requested (deed-back, rescission, etc.)
6. 14-day response deadline
7. Statement of regulatory escalation path if unresponsive (CFPB, state AG)
8. Attorney letterhead placeholders

Format as a proper business letter. Be specific, not generic.
Return ONLY the letter text."""

    letter_response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.anthropic_max_tokens,
        messages=[{"role": "user", "content": letter_prompt}],
    )

    letter_text: str = letter_response.content[0].text  # type: ignore[union-attr]

    # Queue for attorney review via legal-service
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            await http.post(
                f"{settings.legal_service_url}/attorney/review-queue",
                json={
                    "case_id": state["case_id"],
                    "round_number": round_num,
                    "track": state["current_track"],
                    "letter_draft": letter_text,
                    "sla_hours": 4,
                },
            )
    except httpx.HTTPError as e:
        logger.warning("negotiation_orchestrator: failed to queue attorney review: %s", e)

    new_round: dict[str, Any] = {
        "round_number": round_num,
        "track": state["current_track"],
        "letter_draft": letter_text,
        "status": "PENDING_ATTORNEY_REVIEW",
    }

    return {**state, "negotiation_rounds": [new_round]}


# ─── Node: Outcome Processor ──────────────────────────────────────────────────

async def outcome_processor_node(state: CaseState) -> dict[str, Any]:
    """
    Finalizes the case outcome, calculates the contingency fee basis,
    and triggers escrow initiation.
    """
    outcome = state.get("outcome") or {}
    timeshare_data = state["intake_data"].get("extracted", {})

    mortgage = float(timeshare_data.get("outstanding_mortgage", 0))
    maintenance = float(timeshare_data.get("maintenance_fee_annual", 0))
    basis_amount = mortgage + (maintenance * 5)
    fee_amount = basis_amount * 0.07

    processed_outcome = {
        **outcome,
        "fee_calculation": {
            "basis_amount": basis_amount,
            "rate": 0.07,
            "fee_amount": fee_amount,
        },
        "status": "EXIT_CONFIRMED",
    }

    logger.info(
        "outcome_processor: case %s closed. Fee: $%.2f",
        state["case_id"],
        fee_amount,
    )

    return {**state, "outcome": processed_outcome}


# ─── Node: Human Review ───────────────────────────────────────────────────────

async def human_review_node(state: CaseState) -> dict[str, Any]:
    """
    Packages the case context and notifies the ops team via case-service.
    The graph terminates here — a human will re-trigger the appropriate node.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            await http.post(
                f"{settings.case_service_url}/api/v1/internal/human-review",
                json={
                    "case_id": state["case_id"],
                    "reason": state.get("human_review_reason", "Unspecified"),
                    "priority": state.get("human_review_priority", "MEDIUM"),
                    "context": {
                        "qualification_score": state.get("qualification_score"),
                        "current_track": state.get("current_track"),
                        "negotiation_rounds": len(state.get("negotiation_rounds", [])),
                    },
                },
            )
    except httpx.HTTPError as e:
        logger.error("human_review: failed to notify case service: %s", e)

    logger.info(
        "Case %s routed to human review: %s",
        state["case_id"],
        state.get("human_review_reason"),
    )
    return state


# ─── Node: Graceful Decline ───────────────────────────────────────────────────

async def graceful_decline_node(state: CaseState) -> dict[str, Any]:
    """
    Notifies the client that their case does not qualify under the 7% contingency model.
    Provides alternative resources — never leaves client without guidance.
    """
    score = state.get("qualification_score", 0.0)
    logger.info(
        "Case %s gracefully declined. Score: %.3f",
        state["case_id"],
        score or 0.0,
    )

    return {
        **state,
        "outcome": {
            "status": "CLOSED_FAILURE",
            "reason": "Qualification score below threshold",
            "qualification_score": score,
            "recommended_alternatives": [
                "Contact your resort's voluntary exit program directly",
                "Consult a licensed timeshare attorney for individual review",
                "File a complaint with your state's Attorney General if misrepresentation occurred",
            ],
        },
    }


# ─── Routing Functions ────────────────────────────────────────────────────────

def route_after_qualification(state: CaseState) -> str:
    if state.get("requires_human_review"):
        return "human_review"
    if state.get("eligible"):
        return "eligible"
    return "ineligible"


def route_after_negotiation(state: CaseState) -> str:
    if state.get("requires_human_review"):
        return "escalate"
    if state.get("outcome"):
        return "outcome"
    # Limit auto-negotiation to 3 rounds before requiring human review
    if len(state.get("negotiation_rounds", [])) >= 3:
        return "escalate"
    return "continue"


# ─── Graph Assembly ───────────────────────────────────────────────────────────

def build_agent_graph() -> Any:
    """
    Compiles the LangGraph state machine with SQLite checkpointing.
    The compiled graph is thread-safe and can be invoked concurrently per case.
    """
    workflow: StateGraph = StateGraph(CaseState)

    workflow.add_node("intake_analyzer", intake_analyzer_node)
    workflow.add_node("qualification_scorer", qualification_scorer_node)
    workflow.add_node("contract_analyzer", contract_analyzer_node)
    workflow.add_node("strategy_selector", strategy_selector_node)
    workflow.add_node("negotiation_orchestrator", negotiation_orchestrator_node)
    workflow.add_node("outcome_processor", outcome_processor_node)
    workflow.add_node("human_review", human_review_node)
    workflow.add_node("graceful_decline", graceful_decline_node)

    workflow.set_entry_point("intake_analyzer")

    workflow.add_edge("intake_analyzer", "qualification_scorer")

    workflow.add_conditional_edges(
        "qualification_scorer",
        route_after_qualification,
        {
            "eligible": "contract_analyzer",
            "ineligible": "graceful_decline",
            "human_review": "human_review",
        },
    )

    workflow.add_edge("contract_analyzer", "strategy_selector")
    workflow.add_edge("strategy_selector", "negotiation_orchestrator")

    workflow.add_conditional_edges(
        "negotiation_orchestrator",
        route_after_negotiation,
        {
            "continue": "negotiation_orchestrator",
            "outcome": "outcome_processor",
            "escalate": "human_review",
        },
    )

    workflow.add_edge("outcome_processor", END)
    workflow.add_edge("graceful_decline", END)
    workflow.add_edge("human_review", END)

    # Use RedisSaver for durable, cross-pod checkpointing (state survives restarts).
    # Falls back to in-memory MemorySaver if langgraph-checkpoint-redis not installed.
    if _REDIS_SAVER_AVAILABLE:
        checkpointer = RedisSaver(
            redis_url=settings.redis_url,
            ttl=60 * 60 * 24 * 30,  # 30 days
        )
    else:  # pragma: no cover
        checkpointer = RedisSaver()  # in-memory fallback
    return workflow.compile(checkpointer=checkpointer)


# Module-level compiled graph singleton
agent_graph = build_agent_graph()

"""
AI Orchestrator — FastAPI entry point.

Receives Kafka events (case.created, etc.) via a background consumer
and provides HTTP endpoints for manual graph invocation and status queries.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.config import get_settings
from app.graph.agent_graph import agent_graph, CaseState
from app.kafka.consumer import KafkaConsumerService

settings = get_settings()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start Kafka consumer on startup; graceful shutdown on exit."""
    consumer = KafkaConsumerService(agent_graph)
    consumer_task = asyncio.create_task(consumer.start())
    log.info("ai_orchestrator_started", port=settings.port)
    try:
        yield
    finally:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
        log.info("ai_orchestrator_stopped")


app = FastAPI(
    title="ExitForge AI Orchestrator",
    description="LangGraph-powered autonomous case orchestration engine",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── OpenTelemetry instrumentation ────────────────────────────────────────────
try:
    import os
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

    _resource = Resource.create({"service.name": os.getenv("DD_SERVICE", "ai-orchestrator")})
    _provider = TracerProvider(resource=_resource)
    _otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318/v1/traces")
    _provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_otlp_endpoint)))
    trace.set_tracer_provider(_provider)
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
except ImportError:
    pass  # OTel not installed — no-op in minimal environments

# ─── Request / Response Models ────────────────────────────────────────────────

class InvokeGraphRequest(BaseModel):
    case_id: str = Field(..., description="ExitForge case UUID")
    client_id: str
    intake_data: dict[str, Any] = Field(..., description="Raw intake form submission")
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class GraphStatusResponse(BaseModel):
    case_id: str
    status: str
    current_node: str | None
    qualification_score: float | None
    current_track: str | None
    negotiation_rounds: int
    requires_human_review: bool
    human_review_reason: str | None


class ResumeGraphRequest(BaseModel):
    case_id: str
    node: str = Field(..., description="Node to resume execution from")
    state_override: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/graph/invoke", status_code=202)
async def invoke_graph(request: InvokeGraphRequest, background_tasks: BackgroundTasks):
    """
    Asynchronously invoke the full agent graph for a case.
    Returns immediately — graph runs in background.
    """
    initial_state: CaseState = {
        "case_id": request.case_id,
        "client_id": request.client_id,
        "intake_data": request.intake_data,
        "qualification_score": None,
        "eligible": None,
        "contract_report": None,
        "resort_intelligence": None,
        "strategy_plan": None,
        "negotiation_rounds": [],
        "current_track": None,
        "outcome": None,
        "requires_human_review": False,
        "human_review_reason": None,
        "human_review_priority": None,
        "error": None,
        "correlation_id": request.correlation_id,
    }

    config = {"configurable": {"thread_id": request.case_id}}

    background_tasks.add_task(_run_graph, initial_state, config)

    return {"accepted": True, "case_id": request.case_id, "correlation_id": request.correlation_id}


@app.get("/graph/status/{case_id}", response_model=GraphStatusResponse)
async def get_graph_status(case_id: str):
    """
    Get the current LangGraph checkpoint state for a case.
    """
    config = {"configurable": {"thread_id": case_id}}

    try:
        state_snapshot = agent_graph.get_state(config)
        if state_snapshot is None:
            raise HTTPException(status_code=404, detail="No graph state found for this case")

        values: CaseState = state_snapshot.values  # type: ignore[assignment]
        return GraphStatusResponse(
            case_id=case_id,
            status="RUNNING" if state_snapshot.next else "COMPLETED",
            current_node=state_snapshot.next[0] if state_snapshot.next else None,
            qualification_score=values.get("qualification_score"),
            current_track=values.get("current_track"),
            negotiation_rounds=len(values.get("negotiation_rounds", [])),
            requires_human_review=values.get("requires_human_review", False),
            human_review_reason=values.get("human_review_reason"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/graph/resume", status_code=202)
async def resume_graph(request: ResumeGraphRequest, background_tasks: BackgroundTasks):
    """
    Resume a paused graph from a specific node (e.g., after human review).
    Allows ops to unblock cases stuck in human_review.
    """
    config = {"configurable": {"thread_id": request.case_id}}

    if request.state_override:
        agent_graph.update_state(config, request.state_override)

    # Resume from the named node
    background_tasks.add_task(_resume_from_node, config)

    return {"accepted": True, "case_id": request.case_id}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-orchestrator"}


# ─── Internal helpers ─────────────────────────────────────────────────────────

async def _run_graph(initial_state: CaseState, config: dict[str, Any]) -> None:
    try:
        async for event in agent_graph.astream(initial_state, config):
            node_name = next(iter(event))
            log.info("graph_node_completed", case_id=initial_state["case_id"], node=node_name)
    except Exception as e:
        log.error(
            "graph_execution_failed",
            case_id=initial_state["case_id"],
            error=str(e),
        )


async def _resume_from_node(config: dict[str, Any]) -> None:
    try:
        async for event in agent_graph.astream(None, config):
            node_name = next(iter(event))
            log.info("graph_resume_node_completed", node=node_name)
    except Exception as e:
        log.error("graph_resume_failed", error=str(e))

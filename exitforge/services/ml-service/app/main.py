"""
ExitForge ML Service — FastAPI.

Provides:
  POST /predict/qualification  — exit eligibility scoring
  POST /predict/strategy       — exit track recommendation
  POST /predict/timeline       — P50/P90 days-to-close prediction
  GET  /health
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import structlog
from fastapi import FastAPI
from pydantic import BaseModel, Field

log = structlog.get_logger()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)

# ─── Model loading ────────────────────────────────────────────────────────────

MODELS_DIR = Path("models")

def _try_load(name: str) -> Any | None:
    path = MODELS_DIR / f"{name}.pkl"
    if path.exists():
        try:
            model = joblib.load(path)
            log.info("model_loaded", name=name)
            return model
        except Exception as e:
            log.warning("model_load_failed", name=name, error=str(e))
    return None


qualification_model = _try_load("qualification_model")
strategy_model = _try_load("strategy_model")
timeline_model = _try_load("timeline_model")

app = FastAPI(
    title="ExitForge ML Service",
    description="Rules-based + XGBoost scoring for exit eligibility, strategy, and timeline",
    version="1.0.0",
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

    _resource = Resource.create({"service.name": os.getenv("DD_SERVICE", "ml-service")})
    _provider = TracerProvider(resource=_resource)
    _otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318/v1/traces")
    _provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=_otlp_endpoint)))
    trace.set_tracer_provider(_provider)
    FastAPIInstrumentor.instrument_app(app)
except ImportError:
    pass  # OTel not installed — no-op in minimal environments

# ─── Request / Response schemas ───────────────────────────────────────────────

class QualificationRequest(BaseModel):
    resort_name: str
    resort_state: str | None = None
    contract_year: int | None = None
    purchase_price: float
    maintenance_fee_annual: float
    outstanding_mortgage: float
    misrepresentation_count: int = Field(ge=0)
    financial_hardship: bool


class QualificationResponse(BaseModel):
    score: float = Field(ge=0.0, le=1.0)
    eligible: bool
    estimated_recovery_low: float
    estimated_recovery_high: float
    recommended_track: str
    explanation: str


class StrategyRequest(BaseModel):
    qualification_score: float
    contract_report: dict[str, Any]
    resort_intelligence: dict[str, Any]


class StrategyResponse(BaseModel):
    primary_track: str
    fallback_track: str | None
    confidence: float
    rationale: str


class TimelineRequest(BaseModel):
    case_id: str
    exit_track: str
    resort_resistance_score: float = Field(ge=0.0, le=1.0)
    negotiation_round: int = Field(ge=1)


class TimelineResponse(BaseModel):
    p50_days: int
    p90_days: int
    current_stage_days_remaining: int


# ─── Qualification endpoint ───────────────────────────────────────────────────

@app.post("/predict/qualification", response_model=QualificationResponse)
async def predict_qualification(req: QualificationRequest) -> QualificationResponse:
    """
    Predicts exit probability and recommended track.
    Falls back to rules-based scoring until ML model is trained with 100+ cases.
    """
    if qualification_model is not None:
        features = _build_qualification_features(req)
        score = float(qualification_model.predict_proba([features])[0][1])
    else:
        score = _rules_based_score(req)

    recovery_basis = req.outstanding_mortgage + req.maintenance_fee_annual * 5
    track = _recommend_track(req, score)
    explanation = _build_explanation(req, score)

    log.info("qualification_scored", score=score, eligible=score >= 0.65, track=track)

    return QualificationResponse(
        score=round(score, 4),
        eligible=score >= 0.65,
        estimated_recovery_low=round(recovery_basis * 0.6, 2),
        estimated_recovery_high=round(recovery_basis * 1.1, 2),
        recommended_track=track,
        explanation=explanation,
    )


# ─── Strategy endpoint ────────────────────────────────────────────────────────

@app.post("/predict/strategy", response_model=StrategyResponse)
async def predict_strategy(req: StrategyRequest) -> StrategyResponse:
    """
    Recommends exit track based on qualification score + contract + resort data.
    """
    misrep_count = len(req.contract_report.get("misrepresentation_flags", []))
    illegal_count = len(req.contract_report.get("illegal_term_flags", []))
    resistance = float(req.resort_intelligence.get("resistance_score", 0.5))
    deed_back_available = bool(req.resort_intelligence.get("deed_back_available", False))
    has_perpetuity = bool(req.contract_report.get("has_perpetuity_language", False))

    # Decision tree (will be replaced by trained model)
    if misrep_count >= 3 or illegal_count >= 2:
        primary = "REGULATORY_PRESSURE"
        fallback = "LEGAL_DEMAND"
        rationale = f"Strong legal grounds: {misrep_count} misrepresentations, {illegal_count} illegal terms"
    elif deed_back_available and resistance < 0.5:
        primary = "DEED_BACK"
        fallback = "LEGAL_DEMAND"
        rationale = "Resort accepts deed-backs and has low resistance score"
    elif misrep_count >= 1 or has_perpetuity:
        primary = "LEGAL_DEMAND"
        fallback = "DEED_BACK"
        rationale = "Misrepresentation claims support formal legal demand"
    elif req.qualification_score > 0.85:
        primary = "REGULATORY_PRESSURE"
        fallback = "LEGAL_DEMAND"
        rationale = "High qualification score enables regulatory escalation"
    else:
        primary = "DEED_BACK"
        fallback = None
        rationale = "Standard deed-back approach as baseline strategy"

    return StrategyResponse(
        primary_track=primary,
        fallback_track=fallback,
        confidence=round(min(req.qualification_score + 0.1, 0.99), 3),
        rationale=rationale,
    )


# ─── Timeline endpoint ────────────────────────────────────────────────────────

@app.post("/predict/timeline", response_model=TimelineResponse)
async def predict_timeline(req: TimelineRequest) -> TimelineResponse:
    """
    Predicts days to resolution using survival-analysis-inspired heuristics.
    Bootstrap estimates based on industry data until ExitForge history accumulates.
    """
    # Industry baseline estimates (P50, P90) in days
    track_baselines: dict[str, tuple[int, int]] = {
        "DEED_BACK": (90, 150),
        "LEGAL_DEMAND": (120, 210),
        "REGULATORY_PRESSURE": (150, 270),
        "LITIGATION": (270, 540),
    }

    p50_base, p90_base = track_baselines.get(req.exit_track, (180, 300))

    # Resistance adjustment: ±40% around baseline
    resistance_mult = 1.0 + (req.resort_resistance_score - 0.5) * 0.4
    p50 = int(p50_base * resistance_mult)
    p90 = int(p90_base * resistance_mult)

    # Each additional negotiation round adds ~30 days median
    round_penalty = (req.negotiation_round - 1) * 30
    p50 += round_penalty
    p90 += round_penalty

    log.info("timeline_predicted", case_id=req.case_id, p50=p50, p90=p90, track=req.exit_track)

    return TimelineResponse(
        p50_days=p50,
        p90_days=p90,
        current_stage_days_remaining=max(p50 // 3, 14),
    )


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "ml-service",
        "models_loaded": {
            "qualification": qualification_model is not None,
            "strategy": strategy_model is not None,
            "timeline": timeline_model is not None,
        },
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _rules_based_score(req: QualificationRequest) -> float:
    """Bootstrap scoring used before 100+ cases are available for XGBoost training."""
    score = 0.5

    score += min(req.misrepresentation_count * 0.08, 0.24)

    if req.outstanding_mortgage > 0:
        score += 0.08

    if req.contract_year and req.contract_year < 2015:
        score += 0.05

    if req.maintenance_fee_annual > 1500:
        score += 0.05

    if req.financial_hardship:
        score += 0.04

    return min(score, 0.99)


def _build_qualification_features(req: QualificationRequest) -> list[float]:
    """Feature vector for trained XGBoost model."""
    current_year = 2026
    years_owned = (current_year - req.contract_year) if req.contract_year else 10

    return [
        req.purchase_price / 100_000,          # normalized
        req.maintenance_fee_annual / 5_000,
        req.outstanding_mortgage / 100_000,
        float(req.misrepresentation_count),
        float(req.financial_hardship),
        float(years_owned),
    ]


def _recommend_track(req: QualificationRequest, score: float) -> str:
    if req.misrepresentation_count >= 2:
        return "LEGAL_DEMAND"
    if req.outstanding_mortgage == 0:
        return "DEED_BACK"
    if score > 0.8:
        return "REGULATORY_PRESSURE"
    return "DEED_BACK"


def _build_explanation(req: QualificationRequest, score: float) -> str:
    parts = []

    if req.misrepresentation_count > 0:
        parts.append(f"{req.misrepresentation_count} misrepresentation claim(s) identified — strong exit leverage")
    if req.outstanding_mortgage > 0:
        parts.append(f"${req.outstanding_mortgage:,.0f} outstanding mortgage creates financial relief basis")
    if req.financial_hardship:
        parts.append("Financial hardship strengthens negotiating position")
    if req.maintenance_fee_annual > 1500:
        parts.append(f"High annual fee (${req.maintenance_fee_annual:,.0f}) increases recovery basis")
    if req.contract_year and req.contract_year < 2015:
        parts.append("Legacy contract (pre-2015) has more accumulated regulatory exposure")

    if not parts:
        parts.append("Standard case profile — deed-back approach recommended")

    return ". ".join(parts) + f". Exit probability: {score:.0%}."

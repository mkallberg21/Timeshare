from __future__ import annotations

"""
Evidence Pack Service — FastAPI entry point.

Endpoints:
  POST /evidence-packs/generate      — trigger async pack generation
  GET  /evidence-packs/{pack_id}     — get pack status/metadata
  GET  /evidence-packs/case/{case_id} — list packs for a case
  GET  /evidence-packs/{pack_id}/download — redirect to presigned S3 URL
  POST /evidence-packs/{pack_id}/deliver  — email delivery
  POST /evidence-packs/{pack_id}/regenerate — re-run pipeline
  GET  /health
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings

settings = get_settings()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()

# MongoDB client (module-level singleton)
_mongo: AsyncIOMotorClient | None = None
_kafka_task: asyncio.Task | None = None


def get_db():
    if _mongo is None:
        raise RuntimeError("MongoDB not initialized")
    return _mongo[settings.mongodb_db]


async def _trigger_generate(
    case_id: str,
    triggered_by: str,
    delivery_method: str,
    attorney_email: str | None,
) -> None:
    """Internal trigger for Kafka-driven generation."""
    from app.pipeline import run_generation_pipeline
    import uuid

    pack_id = f"ep_{uuid.uuid4().hex[:16]}"
    db = get_db()
    from datetime import datetime

    await db["evidence_packs"].insert_one({
        "_id": pack_id,
        "case_id": case_id,
        "status": "GENERATING",
        "version": 1,
        "triggered_by": triggered_by,
        "delivery_method": delivery_method,
        "attorney_email": attorney_email,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    })

    asyncio.create_task(
        run_generation_pipeline(
            pack_id=pack_id,
            case_id=case_id,
            delivery_method=delivery_method,
            attorney_email=attorney_email,
        )
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _mongo, _kafka_task
    _mongo = AsyncIOMotorClient(settings.mongodb_uri)
    log.info("evidence_pack_service_started", port=settings.port)

    # Start Kafka consumer in background
    from app.kafka.consumer import EvidencePackKafkaConsumer
    consumer = EvidencePackKafkaConsumer(generate_pack_fn=_trigger_generate)
    _kafka_task = asyncio.create_task(consumer.start())

    yield

    if _kafka_task and not _kafka_task.done():
        _kafka_task.cancel()
    _mongo.close()
    log.info("evidence_pack_service_stopped")


app = FastAPI(
    title="ExitForge Evidence Pack Service",
    description="AI-assembled attorney evidence packs for timeshare exit cases",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────

from app.routers.evidence_packs import router as ep_router  # noqa: E402

app.include_router(ep_router)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health() -> dict:
    try:
        db = get_db()
        await db.command("ping")
        mongo_ok = True
    except Exception:
        mongo_ok = False

    return {
        "status": "ok" if mongo_ok else "degraded",
        "service": settings.service_name,
        "version": "1.0.0",
        "dependencies": {
            "mongodb": "ok" if mongo_ok else "error",
        },
    }

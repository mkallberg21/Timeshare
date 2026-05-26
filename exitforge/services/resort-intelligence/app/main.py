"""
Resort Intelligence Service — FastAPI.

Maintains a scored database of resort developers and properties.
Provides:
  POST /score            — score a resort by name/state
  GET  /resorts/{id}     — get resort intelligence profile
  GET  /health
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

log = structlog.get_logger()

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    port: int = 8003
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "exitforge_resorts"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
_mongo: AsyncIOMotorClient | None = None


def get_db():
    if _mongo is None:
        raise RuntimeError("MongoDB not initialized")
    return _mongo[settings.mongodb_db]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _mongo
    _mongo = AsyncIOMotorClient(settings.mongodb_uri)
    # Seed with known problematic resorts
    await _seed_resort_data()
    log.info("resort_intelligence_started")
    yield
    _mongo.close()


app = FastAPI(
    title="ExitForge Resort Intelligence",
    description="Resort scoring and intelligence for exit strategy selection",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── Models ───────────────────────────────────────────────────────────────────

class ResortScoreRequest(BaseModel):
    resort_name: str
    resort_state: str | None = None


class ResortScoreResponse(BaseModel):
    resort_id: str
    resort_name: str
    resistance_score: float = Field(ge=0.0, le=1.0, description="0=cooperative, 1=litigious")
    receptivity_score: float = Field(ge=0.0, le=1.0, description="0=hostile to deed-backs, 1=open")
    deed_back_available: bool
    preferred_exit_track: str
    avg_days_to_close: int | None
    success_rate: float | None
    notes: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/score", response_model=ResortScoreResponse)
async def score_resort(req: ResortScoreRequest) -> ResortScoreResponse:
    """
    Returns resistance/receptivity scores for a resort.
    Falls back to neutral defaults for unknown resorts.
    """
    db = get_db()

    # Fuzzy match on resort name (case-insensitive partial match)
    query: dict[str, Any] = {
        "name": {"$regex": req.resort_name[:20], "$options": "i"}
    }
    if req.resort_state:
        query["state"] = req.resort_state.upper()

    resort = await db["resorts"].find_one(query)

    if resort:
        return ResortScoreResponse(
            resort_id=str(resort["_id"]),
            resort_name=resort["name"],
            resistance_score=resort.get("resistance_score", 0.5),
            receptivity_score=resort.get("receptivity_score", 0.5),
            deed_back_available=resort.get("deed_back_available", False),
            preferred_exit_track=resort.get("preferred_exit_track", "DEED_BACK"),
            avg_days_to_close=resort.get("avg_days_to_close"),
            success_rate=resort.get("success_rate"),
            notes=resort.get("notes", ""),
        )

    # Unknown resort — return neutral defaults
    log.info("resort_not_found_returning_defaults", resort_name=req.resort_name)
    return ResortScoreResponse(
        resort_id=f"unknown-{uuid.uuid4()}",
        resort_name=req.resort_name,
        resistance_score=0.5,
        receptivity_score=0.5,
        deed_back_available=False,
        preferred_exit_track="DEED_BACK",
        avg_days_to_close=None,
        success_rate=None,
        notes="Resort not yet in intelligence database. Using neutral defaults.",
    )


@app.get("/resorts/{resort_id}")
async def get_resort(resort_id: str):
    db = get_db()
    resort = await db["resorts"].find_one({"_id": resort_id})
    if not resort:
        raise HTTPException(status_code=404, detail="Resort not found")
    resort["id"] = resort.pop("_id")
    return resort


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "resort-intelligence"}


# ─── Seed data ────────────────────────────────────────────────────────────────

async def _seed_resort_data() -> None:
    """
    Seeds known resort profiles from industry research.
    Only inserts if collection is empty.
    """
    db = get_db()
    count = await db["resorts"].count_documents({})
    if count > 0:
        return

    known_resorts = [
        {
            "_id": "wyndham-001",
            "name": "Wyndham",
            "developer": "Travel + Leisure Co.",
            "state": "FL",
            "resistance_score": 0.75,
            "receptivity_score": 0.35,
            "deed_back_available": True,
            "preferred_exit_track": "LEGAL_DEMAND",
            "avg_days_to_close": 180,
            "success_rate": 0.72,
            "notes": "Has formal Certified Exit program but slow. Legal demand often more effective.",
        },
        {
            "_id": "marriott-001",
            "name": "Marriott Vacations Worldwide",
            "developer": "Marriott Vacations Worldwide",
            "state": "FL",
            "resistance_score": 0.65,
            "receptivity_score": 0.45,
            "deed_back_available": True,
            "preferred_exit_track": "DEED_BACK",
            "avg_days_to_close": 150,
            "success_rate": 0.78,
            "notes": "Has deed-back program; receptive to qualified exits.",
        },
        {
            "_id": "diamond-001",
            "name": "Diamond Resorts",
            "developer": "Hilton Grand Vacations",
            "state": "NV",
            "resistance_score": 0.80,
            "receptivity_score": 0.30,
            "deed_back_available": False,
            "preferred_exit_track": "REGULATORY_PRESSURE",
            "avg_days_to_close": 240,
            "success_rate": 0.65,
            "notes": "Highly resistant. Regulatory and AG complaints are most effective.",
        },
        {
            "_id": "bluegreen-001",
            "name": "Bluegreen Vacations",
            "developer": "Bluegreen Vacations",
            "state": "FL",
            "resistance_score": 0.70,
            "receptivity_score": 0.40,
            "deed_back_available": True,
            "preferred_exit_track": "LEGAL_DEMAND",
            "avg_days_to_close": 160,
            "success_rate": 0.70,
            "notes": "Deed-back available but requires strong misrepresentation evidence.",
        },
    ]

    if known_resorts:
        await db["resorts"].insert_many(known_resorts)
        log.info("resort_data_seeded", count=len(known_resorts))

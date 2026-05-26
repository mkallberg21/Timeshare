from __future__ import annotations

"""Integration-style tests for Evidence Pack API endpoints."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=db)
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=None)
    collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id="ep_test001"))
    collection.update_one = AsyncMock()
    db.__getitem__ = MagicMock(return_value=collection)
    return db, collection


@pytest.fixture
def client(mock_db):
    db, collection = mock_db
    with patch("app.main._mongo") as mock_mongo:
        mock_mongo.__getitem__ = MagicMock(return_value=db)
        with patch("app.main.get_db", return_value=db):
            from app.main import app
            with TestClient(app, raise_server_exceptions=True) as c:
                yield c, collection


def test_health_endpoint():
    with patch("app.main._mongo") as mock_mongo, \
         patch("app.main.get_db") as mock_get_db:

        mock_db_obj = AsyncMock()
        mock_db_obj.command = AsyncMock(return_value={"ok": 1})
        mock_get_db.return_value = mock_db_obj

        from app.main import app
        with TestClient(app) as c:
            resp = c.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "evidence-pack-service"


def test_generate_endpoint_returns_202():
    """POST /evidence-packs/generate should return 202 with pack_id."""
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=None)
    collection.insert_one = AsyncMock()

    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=collection)

    with patch("app.main.get_db", return_value=db), \
         patch("app.routers.evidence_packs.get_db", return_value=db), \
         patch("app.routers.evidence_packs.run_generation_pipeline", new_callable=AsyncMock):

        from app.main import app
        with TestClient(app) as c:
            resp = c.post(
                "/evidence-packs/generate",
                json={"case_id": "CASE-001", "delivery_method": "PORTAL"},
            )

    assert resp.status_code == 202
    data = resp.json()
    assert "pack_id" in data
    assert data["status"] == "GENERATING"


def test_get_pack_not_found_returns_404():
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=None)

    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=collection)

    with patch("app.main.get_db", return_value=db), \
         patch("app.routers.evidence_packs.get_db", return_value=db):

        from app.main import app
        with TestClient(app) as c:
            resp = c.get("/evidence-packs/ep_nonexistent")

    assert resp.status_code == 404


def test_download_pack_409_when_generating():
    """Download endpoint should return 409 if pack is still GENERATING."""
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value={
        "_id": "ep_test001",
        "case_id": "CASE-001",
        "status": "GENERATING",
        "version": 1,
    })

    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=collection)

    with patch("app.main.get_db", return_value=db), \
         patch("app.routers.evidence_packs.get_db", return_value=db):

        from app.main import app
        with TestClient(app, follow_redirects=False) as c:
            resp = c.get("/evidence-packs/ep_test001/download")

    assert resp.status_code == 409

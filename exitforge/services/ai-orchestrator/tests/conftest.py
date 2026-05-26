"""Shared test fixtures for ai-orchestrator."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def mock_settings(monkeypatch):
    """Patch settings so no real env vars needed."""
    with patch("app.config.get_settings") as mock_get:
        settings = MagicMock()
        settings.anthropic_api_key = "sk-test-key"
        settings.anthropic_model = "claude-sonnet-4-20250514"
        settings.redis_url = "redis://localhost:6379"
        settings.kafka_brokers = "localhost:9092"
        settings.kafka_group_id = "ai-orchestrator"
        settings.case_service_url = "http://case-service:4000"
        settings.port = 8002
        mock_get.return_value = settings
        yield settings

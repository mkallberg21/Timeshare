from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Service identity
    service_name: str = "ai-orchestrator"
    environment: str = "development"
    port: int = 8005

    # AI
    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-4-20250514"
    anthropic_max_tokens: int = 2000

    # Internal services
    ml_service_url: str = "http://ml-service:8001"
    document_service_url: str = "http://document-service:8002"
    resort_intelligence_url: str = "http://resort-intelligence:8003"
    legal_service_url: str = "http://legal-service:8004"
    case_service_url: str = "http://case-service:4000"

    # Kafka
    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "ai-orchestrator-consumers"

    # Redis (used for LangGraph checkpointing in prod)
    redis_url: str = "redis://localhost:6379"

    # Observability
    datadog_api_key: str = ""
    dd_env: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()

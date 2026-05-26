from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Service identity
    service_name: str = "evidence-pack-service"
    environment: str = "development"
    port: int = 8006

    # AI
    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-4-20250514"
    anthropic_max_tokens: int = 4000

    # AWS / S3
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_bucket_name: str = "exitforge-documents"

    # MongoDB (pack content store)
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "exitforge_evidence_packs"

    # PostgreSQL (pack metadata — mirroring case-service DB)
    case_service_url: str = "http://case-service:4000"
    document_service_url: str = "http://document-service:8002"
    resort_intelligence_url: str = "http://resort-intelligence:8003"

    # Kafka
    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "evidence-pack-consumers"
    kafka_client_id: str = "evidence-pack-service"

    # SendGrid
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "legal@exitforge.com"
    sendgrid_from_name: str = "ExitForge Legal Operations"

    # Presigned URL expiry
    presigned_url_expiry_seconds: int = 604800  # 7 days

    # Observability
    dd_service: str = "exitforge-evidence-pack-service"
    dd_env: str = "production"
    otlp_endpoint: str = "http://datadog-agent:4318"


@lru_cache
def get_settings() -> Settings:
    return Settings()

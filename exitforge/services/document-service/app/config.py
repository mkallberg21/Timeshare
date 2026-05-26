from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8002
    debug: bool = False

    # AWS
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_bucket_name: str = "exitforge-documents"
    textract_role_arn: str = ""

    # MongoDB (document intelligence store)
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "exitforge_documents"

    # Anthropic
    anthropic_api_key: str = ""

    # Kafka
    kafka_brokers: str = "localhost:9092"
    kafka_client_id: str = "document-service"

    # Observability
    dd_service: str = "exitforge-document-service"
    dd_env: str = "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

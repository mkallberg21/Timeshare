from anthropic import AsyncAnthropic
from functools import lru_cache
from app.config import get_settings


@lru_cache
def get_claude_client() -> AsyncAnthropic:
    settings = get_settings()
    return AsyncAnthropic(api_key=settings.anthropic_api_key)

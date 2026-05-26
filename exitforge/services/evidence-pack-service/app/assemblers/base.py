from __future__ import annotations

import json
import logging
from typing import Any

from anthropic import AsyncAnthropic
from pydantic import BaseModel

from app.models.evidence_pack import CaseContext

log = logging.getLogger(__name__)


class BaseAssembler:
    """
    Base class for all section assemblers.
    Every assembler follows this pattern: call Claude with a section-specific
    system prompt, validate the JSON response with a Pydantic model, return.
    """

    def __init__(self, anthropic_client: AsyncAnthropic, case_context: CaseContext) -> None:
        self.client = anthropic_client
        self.ctx = case_context

    async def assemble(self) -> BaseModel:
        raise NotImplementedError

    async def _call_claude(self, prompt: str, schema: type[BaseModel]) -> BaseModel:
        from app.config import get_settings
        settings = get_settings()

        response = await self.client.messages.create(
            model=settings.anthropic_model,
            max_tokens=settings.anthropic_max_tokens,
            system=self._system_prompt(),
            messages=[{"role": "user", "content": prompt}],
        )

        raw: str = response.content[0].text  # type: ignore[union-attr]
        # Strip any markdown fences Claude might add
        clean = raw.strip().removeprefix("```json").removesuffix("```").strip()

        try:
            data: dict[str, Any] = json.loads(clean)
        except json.JSONDecodeError as exc:
            log.error(
                "assembler_json_parse_error",
                assembler=type(self).__name__,
                error=str(exc),
                raw_preview=raw[:200],
            )
            raise ValueError(f"{type(self).__name__}: Claude returned non-JSON: {exc}") from exc

        return schema.model_validate(data)

    def _system_prompt(self) -> str:
        raise NotImplementedError

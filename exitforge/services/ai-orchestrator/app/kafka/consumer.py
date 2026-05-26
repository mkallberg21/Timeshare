"""
Kafka consumer for the AI Orchestrator.
Listens to case.created and message.received events and triggers graph execution.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from aiokafka import AIOKafkaConsumer
from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


class KafkaConsumerService:
    def __init__(self, graph: Any) -> None:
        self.graph = graph
        self._consumer: AIOKafkaConsumer | None = None

    async def start(self) -> None:
        brokers = settings.kafka_brokers.split(",")

        self._consumer = AIOKafkaConsumer(
            "exitforge.cases",
            "exitforge.messages",
            bootstrap_servers=brokers,
            group_id=settings.kafka_group_id,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            auto_offset_reset="earliest",
            enable_auto_commit=False,
        )

        await self._consumer.start()
        log.info("Kafka consumer started, listening on exitforge.cases, exitforge.messages")

        try:
            async for msg in self._consumer:
                await self._handle_message(msg)
                await self._consumer.commit()
        except Exception as e:
            log.error("Kafka consumer error: %s", e)
            raise
        finally:
            await self._consumer.stop()

    async def _handle_message(self, msg: Any) -> None:
        event: dict[str, Any] = msg.value
        event_type: str = event.get("eventType", "")
        payload: dict[str, Any] = event.get("payload", {})
        correlation_id: str = event.get("metadata", {}).get("correlationId", "")

        log.info("Received Kafka event: %s for case %s", event_type, event.get("aggregateId"))

        if event_type == "case.created":
            await self._handle_case_created(payload, correlation_id)
        elif event_type == "message.received":
            await self._handle_message_received(payload, correlation_id)
        else:
            log.debug("Unhandled event type: %s", event_type)

    async def _handle_case_created(self, payload: dict[str, Any], correlation_id: str) -> None:
        """Trigger full graph run for a new case."""
        case_id: str = payload.get("caseId", "")
        client_id: str = payload.get("clientId", "")

        if not case_id or not client_id:
            log.error("case.created payload missing caseId or clientId")
            return

        from app.graph.agent_graph import CaseState

        initial_state: CaseState = {
            "case_id": case_id,
            "client_id": client_id,
            "intake_data": payload.get("intakeData", {}),
            "qualification_score": None,
            "eligible": None,
            "contract_report": None,
            "resort_intelligence": None,
            "strategy_plan": None,
            "negotiation_rounds": [],
            "current_track": None,
            "outcome": None,
            "requires_human_review": False,
            "human_review_reason": None,
            "human_review_priority": None,
            "error": None,
            "correlation_id": correlation_id,
        }

        config = {"configurable": {"thread_id": case_id}}

        try:
            async for event in self.graph.astream(initial_state, config):
                node_name = next(iter(event))
                log.info("Node completed: %s for case %s", node_name, case_id)
        except Exception as e:
            log.error("Graph failed for case %s: %s", case_id, e)

    async def _handle_message_received(
        self, payload: dict[str, Any], correlation_id: str
    ) -> None:
        """
        Generate an AI response to a client message.
        Uses Claude with case context — target P90 response time < 120s.
        """
        from app.llm.claude_client import get_claude_client

        case_id: str = payload.get("caseId", "")
        content: str = payload.get("content", "")

        if not case_id or not content:
            return

        client = get_claude_client()

        prompt = f"""You are ExitForge's AI case manager. A client with case ID {case_id} sent:

"{content}"

Respond professionally and helpfully. If the question is about:
- Case status → acknowledge and say you'll pull the latest update
- Timeline → provide context that timelines vary and the team is actively working
- Legal questions → explain you'll connect them with their assigned attorney

Keep response under 200 words. Do not fabricate specific dates or outcomes."""

        try:
            response = await client.messages.create(
                model=settings.anthropic_model,
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
            ai_response: str = response.content[0].text  # type: ignore[union-attr]
            log.info("AI message response generated for case %s", case_id)
            # TODO: push ai_response back to case-service via HTTP or Kafka
            _ = ai_response
        except Exception as e:
            log.error("Failed to generate AI message response: %s", e)

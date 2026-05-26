from __future__ import annotations

import json
import logging
from typing import Any

from aiokafka import AIOKafkaConsumer
from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


class EvidencePackKafkaConsumer:
    """
    Listens for case events that trigger automatic evidence pack generation.

    Triggers:
      case.status.changed → ESCALATED_LEGAL  → auto-generate + deliver to attorney
      case.status.changed → STRATEGY_SELECTED + LITIGATION track → auto-generate
      negotiation stalled (2+ rounds NO_RESPONSE) → auto-generate + notify ops
    """

    def __init__(self, generate_pack_fn: Any) -> None:
        self._generate = generate_pack_fn
        self._consumer: AIOKafkaConsumer | None = None

    async def start(self) -> None:
        brokers = settings.kafka_brokers.split(",")
        self._consumer = AIOKafkaConsumer(
            "exitforge.cases",
            "exitforge.negotiations",
            bootstrap_servers=brokers,
            group_id=settings.kafka_group_id,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            auto_offset_reset="earliest",
            enable_auto_commit=False,
        )
        await self._consumer.start()
        log.info("evidence_pack_kafka_consumer_started")

        try:
            async for msg in self._consumer:
                await self._handle(msg)
                await self._consumer.commit()
        except Exception as exc:
            log.error("evidence_pack_consumer_error", error=str(exc))
            raise
        finally:
            await self._consumer.stop()

    async def _handle(self, msg: Any) -> None:
        event: dict[str, Any] = msg.value
        event_type: str = event.get("eventType", "")
        payload: dict[str, Any] = event.get("payload", {})
        case_id: str = event.get("aggregateId", "")

        log.debug("kafka_event_received", event_type=event_type, case_id=case_id)

        if event_type == "case.status.changed":
            await self._handle_status_changed(case_id, payload)
        elif event_type in ("case.negotiation.response.received",):
            await self._handle_negotiation_response(case_id, payload)

    async def _handle_status_changed(
        self, case_id: str, payload: dict[str, Any]
    ) -> None:
        new_status: str = payload.get("newStatus", "")

        if new_status == "ESCALATED_LEGAL":
            log.info("auto_trigger_pack_escalated_legal", case_id=case_id)
            await self._generate(
                case_id=case_id,
                triggered_by="kafka:case.status.changed:ESCALATED_LEGAL",
                delivery_method="EMAIL",
                attorney_email=payload.get("assignedAttorneyEmail"),
            )

        elif new_status == "STRATEGY_SELECTED":
            exit_track: str = payload.get("exitTrack", "")
            if exit_track == "LITIGATION":
                log.info("auto_trigger_pack_litigation_strategy", case_id=case_id)
                await self._generate(
                    case_id=case_id,
                    triggered_by="kafka:case.status.changed:STRATEGY_SELECTED:LITIGATION",
                    delivery_method="PORTAL",
                    attorney_email=None,
                )

    async def _handle_negotiation_response(
        self, case_id: str, payload: dict[str, Any]
    ) -> None:
        response_type: str = payload.get("responseType", "")
        round_number: int = payload.get("roundNumber", 0)

        if response_type == "NO_RESPONSE" and round_number >= 2:
            log.info("auto_trigger_pack_stalled_negotiation", case_id=case_id, round=round_number)
            await self._generate(
                case_id=case_id,
                triggered_by=f"kafka:negotiation.stalled:round_{round_number}",
                delivery_method="PORTAL",
                attorney_email=None,
            )

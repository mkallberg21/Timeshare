# ADR-004: Apache Kafka over SQS / RabbitMQ for Event Bus

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** Engineering Leadership  

---

## Context

10 services need to communicate asynchronously. Events like `case.status_changed`, `document.analyzed`, and `negotiation.letter_generated` must be delivered reliably and in order per case. We also need:
- Replay capability (reprocess events after a bug fix without data loss)
- Exactly-once semantics for fee-related events (double-charging is catastrophic)
- An event log that acts as an audit trail for compliance

## Decision

Use **Apache Kafka** (via AWS MSK in production, Bitnami Kafka in development).

All services use KafkaJS with transactional producers. Events follow a typed `KafkaEvent<T>` envelope with `aggregateId` as the Kafka key (guaranteeing per-case ordering).

## Consequences

### Positive
- **Log retention:** Kafka retains events by default. After a bug in the AI orchestrator, we can replay `case.created` events without any data re-entry
- **Exactly-once delivery:** Transactional producers + `transactionalId` prevent duplicate fee calculations even under consumer restarts
- **Per-case ordering:** Using `caseId` as the Kafka partition key guarantees events for a single case are processed in order
- **Fan-out:** Multiple consumers can subscribe to the same topic (e.g., both `ai-orchestrator` and `communication-service` consume `case.status_changed`)
- **Decoupling:** Services never import each other; all cross-service communication is through events

### Negative
- Kafka requires Zookeeper in dev (adds complexity to `docker-compose.yml`)
- Higher ops overhead than SQS — requires MSK cluster management in production
- KafkaJS transactional producers require careful handling of `abort()` on failure
- No built-in dead-letter queue — must implement manually with a separate topic

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| AWS SQS/SNS | No replay; FIFO queues don't support fan-out; vendor lock-in |
| RabbitMQ | No event log; messages are consumed and gone; harder replay |
| Redis Pub/Sub | No persistence; if a consumer is down, messages are lost |
| AWS EventBridge | Schema registry lag; no replay; vendor lock-in |
| gRPC streaming | Synchronous; not suitable for fire-and-forget event patterns |

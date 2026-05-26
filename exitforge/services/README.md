# services/

This directory contains all backend microservices. Each service is independently deployable and communicates via Kafka events.

## Services

| Service | Port | Language | Runtime | Description |
|---|---|---|---|---|
| [`case-service`](case-service/) | 3001 | TypeScript | NestJS + Fastify | Core case lifecycle, client management, Prisma/Postgres |
| [`intake-service`](intake-service/) | 3002 | TypeScript | NestJS + Fastify | Handles new case intake form submissions |
| [`negotiation-service`](negotiation-service/) | 3003 | TypeScript | NestJS + Fastify | Generates and tracks negotiation letters |
| [`communication-service`](communication-service/) | 3004 | TypeScript | NestJS + Fastify | Email/SMS delivery via SendGrid + Twilio |
| [`payment-service`](payment-service/) | 3005 | TypeScript | NestJS + Fastify | Stripe payment collection + Escrow.com fee holding |
| [`legal-service`](legal-service/) | 3006 | TypeScript | NestJS + Fastify | Attorney assignment, legal document generation |
| [`document-service`](document-service/) | 3007 | Python | FastAPI + Motor | Contract upload, S3 storage, Claude analysis |
| [`ml-service`](ml-service/) | 8001 | Python | FastAPI | Qualification scoring, ML inference |
| [`ai-orchestrator`](ai-orchestrator/) | 8000 | Python | FastAPI + LangGraph | End-to-end case processing state machine |
| [`resort-intelligence`](resort-intelligence/) | 3008 | TypeScript | NestJS + Fastify | Resort profiles, negotiation strategy lookup |

## Communication Pattern

All cross-service communication is **event-driven via Kafka**. Services never call each other's HTTP endpoints directly (the AI orchestrator is the only exception, calling `case-service` to update case status).

```
intake-service  →  case.intake_completed  →  ai-orchestrator
ai-orchestrator →  case.status_changed    →  case-service, communication-service
document-service→  document.analyzed     →  ai-orchestrator
payment-service →  payment.escrow_created →  case-service, communication-service
```

## Adding a New Service

1. Copy the `case-service` structure as a template
2. Add to `pnpm-workspace.yaml` (already covered by `services/*`)
3. Add to `turbo.json` if it needs build/test/lint pipelines
4. Add to `infrastructure/docker-compose.yml` for local development
5. Add to `infrastructure/kubernetes/values.yaml` for production
6. Create a `README.md` and `.env.example` in the service directory

# ADR-005: PostgreSQL as Primary DB + MongoDB for Documents

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** Engineering Leadership  

---

## Context

ExitForge has two distinct data shapes:

1. **Relational case data** — Clients, Cases, Timeshares, Negotiations, Fees — these are highly relational, transactional (fee calculation must be atomic), and need ACID guarantees
2. **Document analysis results** — `ContractIntelligenceReport` is a deeply nested, variable-structure JSON document that changes shape as we improve the Claude analysis prompt. Schema migrations for this in PostgreSQL would be extremely painful

## Decision

Use **PostgreSQL 16** for the relational case domain (via Prisma ORM in `case-service`) and **MongoDB 7** for document analysis results and resort intelligence profiles.

## Consequences

### Positive
- PostgreSQL gives full ACID transactions for the case state machine — a `fee` record and a `CaseEvent` are written in the same transaction or not at all
- Prisma provides type-safe queries with zero raw SQL; all queries are parameterized
- MongoDB's schemaless document model is ideal for `ContractIntelligenceReport` — we can add `new_clause_type: "PERPETUITY"` without running a migration
- Resort intelligence profiles are naturally document-shaped with nested arrays of negotiation strategies
- Two purpose-built databases rather than one compromised one

### Negative
- Developers must know two query paradigms (Prisma for PG, Motor/pymongo for Mongo)
- Two databases to operate, backup, and monitor
- Cross-database transactions are impossible — must accept eventual consistency between case status (PG) and document analysis (Mongo)
- MongoDB requires schema validation discipline (enforced via Pydantic models in Python services)

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| PostgreSQL only with JSONB | JSONB queries are clunky; no native ODM; schema migrations still required for top-level changes |
| MongoDB only | No ACID transactions for fee calculations; financial data requires relational integrity |
| DynamoDB | No ad-hoc queries; expensive at scale; developer experience is poor |
| CockroachDB | Operational complexity; no benefit at current scale |

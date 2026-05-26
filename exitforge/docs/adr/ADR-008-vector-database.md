# ADR-008: Deferring Pinecone — pgvector as Interim Vector Store

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** AI Team  

---

## Context

The negotiation strategy engine benefits from semantic search over historical case outcomes — "find the 10 cases most similar to this one and use their negotiation trajectories as few-shot examples for Claude." This requires a vector database.

Initial evaluation considered Pinecone (managed), pgvector (PostgreSQL extension), and Weaviate (self-hosted).

## Decision

**Defer vector search entirely for v1** and use structured resort intelligence profiles (MongoDB) + rules-based strategy selection as a proxy. When vector search becomes necessary (estimated at 500+ closed cases), use **pgvector** as the first implementation before evaluating Pinecone.

Rationale: At launch, there are zero historical cases. A vector database requires training data to be useful. Building Pinecone integration now would be infrastructure with no data to put in it.

## Consequences

### Positive
- Zero additional infrastructure cost and complexity at launch
- pgvector runs inside the existing PostgreSQL RDS instance — no new managed service
- When the time comes, `pgvector` + `prisma-client-js` custom SQL is straightforward to implement
- Avoids vendor lock-in to Pinecone until we understand our similarity search patterns

### Negative
- Negotiation strategy is less personalized in v1 — relies on resort profiles not case history
- pgvector has known performance limitations above ~1M vectors (requires HNSW index tuning)
- Migration from pgvector to Pinecone at scale requires an embedding re-ingestion pipeline

## Future Decision Point

When closed case count exceeds 500, re-evaluate:
- If similarity search latency with pgvector + HNSW index is < 50ms at P99 → stay on pgvector
- If latency exceeds 50ms or operational cost of tuning is high → migrate to Pinecone Serverless

## Alternatives Evaluated

| Option | Assessment |
|---|---|
| Pinecone Serverless | Best developer experience; $0.096/GB/month at rest; evaluate at 500+ cases |
| Weaviate (self-hosted) | Too much operational overhead for a startup; requires dedicated cluster |
| Qdrant | Strong performance; self-hosted or managed; viable alternative to Pinecone |
| pgvector | Best immediate fit — uses existing PG instance, no new infra |
| ChromaDB | Embedded only or complex distributed mode; not production-grade at scale |

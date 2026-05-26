# ADR-003: LangGraph for AI Orchestration

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** AI Team, Engineering Leadership  

---

## Context

The ExitForge AI pipeline must orchestrate 8 sequential + conditional steps (intake analysis → qualification → contract analysis → strategy selection → negotiation → outcome). It must:
- Pause for human review and resume when approved
- Checkpoint state so a server restart doesn't lose progress
- Route to different nodes based on intermediate results (e.g., ineligible → graceful_decline)
- Be inspectable — an engineer must be able to see exactly which node a case is stuck in

## Decision

Use **LangGraph** (Python) for the AI orchestration layer.

LangGraph models the case lifecycle as a `StateGraph` where nodes are async Python functions and edges are conditional based on state values. The `MemorySaver` checkpointer persists state in Redis between invocations.

## Consequences

### Positive
- Human-in-the-loop is a first-class primitive: `interrupt_before=["human_review"]` pauses the graph, resumes via `/graph/resume`
- State is a `TypedDict` with Annotated list fields — LangGraph merges partial updates automatically
- Full execution trace available via `graph.get_state_history(config)` — invaluable for debugging
- Conditional edges (`add_conditional_edges`) make branching logic explicit and testable
- Built-in support for `async` nodes — all HTTP calls to downstream services are non-blocking

### Negative
- LangGraph is a relatively young library (Langchain ecosystem); API stability risk
- Adds `langgraph` + `langchain-core` to Python dependencies
- The graph definition is code, not config — changing the flow requires a deploy

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Plain async Python with `asyncio` | No built-in checkpointing, human-in-the-loop requires custom implementation |
| Temporal.io | Operationally complex; requires separate Temporal cluster |
| Prefect / Dagster | Designed for data pipelines, not LLM agent loops |
| OpenAI Assistants API | Vendor lock-in; no support for non-OpenAI models (we use Claude) |
| Langchain LCEL | No native state machine; sequential chains only |

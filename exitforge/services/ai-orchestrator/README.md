# ai-orchestrator

The AI processing pipeline for ExitForge cases. Built with LangGraph (Python) and Claude claude-sonnet-4 via the Anthropic API.

## Responsibilities

- Consumes `case.created` events from Kafka
- Runs cases through an 8-node LangGraph `StateGraph`
- Checkpoints state to Redis between nodes (resumable on crash)
- Pauses for human review when qualification score is ambiguous
- Emits `case.status_changed` events as the graph progresses

## Graph Nodes

```
intake_analyzer → qualification_scorer → contract_analyzer
                                       ↓
                              (ineligible) graceful_decline
                                       ↓
                              strategy_selector → negotiation_orchestrator
                                                ↓
                                       (needs review) human_review
                                                ↓
                                       outcome_processor
```

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health + graph initialization status |
| `POST` | `/graph/resume` | Resume a paused graph (human review decision) |
| `GET` | `/graph/state/:caseId` | Get current graph state for a case |

## Local Setup

```bash
cd services/ai-orchestrator

# Create virtualenv
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env
cp .env.example .env
# Add your Anthropic API key

# Start Redis and Kafka (from repo root)
docker compose -f infrastructure/docker-compose.yml up -d redis kafka

# Run
uvicorn app.main:app --reload --port 8000
```

## Running Tests

```bash
pytest                     # all tests
pytest tests/test_graph.py # single file
pytest --cov=app           # with coverage
```

## Environment Variables

See [`docs/environment-variables.md`](../../docs/environment-variables.md#ai-orchestrator-port-8000-python) for full reference.

## Dependencies

- **Kafka** — Consumes `case.events`, emits `case.status_changed`
- **Redis** — LangGraph MemorySaver checkpoint storage
- **Anthropic API** — Claude claude-sonnet-4 for all LLM nodes
- **case-service** — HTTP calls to update case status

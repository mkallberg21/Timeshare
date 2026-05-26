# document-service

Handles document uploads, S3 storage, and AI-powered contract analysis.

## Responsibilities

- Generates pre-signed S3 URLs for direct browser → S3 uploads (no documents pass through backend servers)
- Triggers Claude-based analysis after upload confirmation
- Stores structured `ContractIntelligenceReport` documents in MongoDB
- Emits `document.analyzed` Kafka events for the AI orchestrator

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/documents/presign` | Get a pre-signed S3 upload URL |
| `POST` | `/documents/confirm` | Confirm upload complete, trigger analysis |
| `GET` | `/documents/:id` | Get document metadata and analysis result |
| `GET` | `/health` | Health check |

## Local Setup

```bash
cd services/document-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 3007
```

## Environment Variables

See [`docs/environment-variables.md`](../../docs/environment-variables.md#document-service-port-3007-python) for full reference.

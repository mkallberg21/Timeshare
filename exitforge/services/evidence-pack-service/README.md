# evidence-pack-service

AI-assembled attorney evidence packs for timeshare exit cases. This service takes a full case context and produces a professionally formatted PDF containing 11 sections of legal analysis, ready for an attorney to review and act upon.

## Overview

When a case reaches `ESCALATED_LEGAL` status, is assigned a `LITIGATION` strategy, or negotiation stalls after 2+ rounds, this service:

1. Fetches the full case context from `case-service`
2. Runs 11 specialized Claude AI assemblers in parallel
3. Renders the result to a PDF using WeasyPrint + Jinja2
4. Uploads the PDF to S3 (`evidence-packs/{case_id}/{pack_id}/v{version}.pdf`)
5. Updates the MongoDB record to `READY`
6. Emits a `evidence_pack.ready` Kafka event
7. Optionally delivers via SendGrid to the assigned attorney

## Port

`8006`

## What's in a Pack

| § | Section | Description |
|---|---------|-------------|
| 1 | Executive Summary | 5-minute attorney go/no-go, strength score, key deadlines |
| 2 | Client Declaration | Sworn statement cross-referenced to contract clauses |
| 3 | Contract Analysis | Annotated illegal clauses by CRITICAL / MAJOR / MINOR severity |
| 4 | Misrepresentation Matrix | Per-claim evidence table with settlement leverage ratings |
| 5 | Applicable Law Brief | State + federal statutes, SOL calculation with tolling analysis |
| 6 | Financial Impact Analysis | Lifetime exposure, damages calculation, maintenance fee projections |
| 7 | Resort Profile | Developer history, regulatory actions, negotiation intelligence |
| 8 | Prior Negotiation History | Round-by-round summary, response patterns, recommended next step |
| 9 | Demand Letter Draft | Tone-calibrated by resort resistance score; attorney-ready |
| 10 | CFPB Complaint Draft | Pre-filled complaint narrative (< 2,000 chars) |
| 11 | Supporting Documents | S3 presigned URL index (7-day links) with missing doc flags |

## API Endpoints

```
POST   /evidence-packs/generate           → 202 { pack_id, status: "GENERATING" }
GET    /evidence-packs/{pack_id}          → EvidencePackRecord
GET    /evidence-packs/case/{case_id}     → { packs, count }
GET    /evidence-packs/{pack_id}/download → 302 redirect to presigned S3 URL
POST   /evidence-packs/{pack_id}/deliver  → deliver via SendGrid
POST   /evidence-packs/{pack_id}/regenerate → re-run pipeline, increment version
GET    /health
```

## Kafka

**Consumed topics:**
| Topic | Event | Trigger |
|-------|-------|---------|
| `exitforge.cases` | `case.status.changed` → `ESCALATED_LEGAL` | Auto-generate + email attorney |
| `exitforge.cases` | `case.status.changed` → `STRATEGY_SELECTED` (LITIGATION) | Auto-generate to PORTAL |
| `exitforge.cases` | `case.negotiation.response.received` NO_RESPONSE ≥ 2 rounds | Auto-generate to PORTAL |

**Emitted events:**
| Event | When |
|-------|------|
| `evidence_pack.generation_started` | Pipeline starts |
| `evidence_pack.ready` | PDF uploaded to S3 |
| `evidence_pack.delivered` | SendGrid delivery confirmed |
| `evidence_pack.failed` | Any assembly/PDF/S3 error |

## Automatic Triggers (LangGraph)

The `evidence_pack_generator_node` in `ai-orchestrator` fires after `negotiation_orchestrator` resolves (either outcome or escalation), calling `POST /evidence-packs/generate` with the case context. The call is fire-and-forget — the graph does not wait for PDF generation.

## State Database — 12 States

The `app/legal/statutes.py` module contains a curated statute database for the 12 primary timeshare states: FL, NV, AZ, SC, TN, MO, GA, HI, VA, CO, CA, TX.

Each entry contains:
- Rescission period (days)
- Statute of limitations (years)
- Primary timeshare statute with citation and key provision
- Consumer protection statute
- Attorney fees, punitive damages availability and cap
- State AG + real estate division complaint URLs

## Claude Model

`claude-sonnet-4-20250514` with `max_tokens=4000` per assembler call.

## Environment Variables

See `.env.example` for all required variables.

Key variables:
```
ANTHROPIC_API_KEY         Required
S3_BUCKET_NAME            Required
MONGODB_URI               Required
CASE_SERVICE_URL          Default: http://case-service:4000
KAFKA_BROKERS             Default: kafka:9092
SENDGRID_API_KEY          Required for email delivery
```

## Running Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload
```

## Running Tests

```bash
pytest -v
```

## Docker

```bash
docker build -t evidence-pack-service .
docker run -p 8006:8006 --env-file .env evidence-pack-service
```

## Security Notes

- All PDFs are server-side encrypted at rest (`AES256`) in S3
- Pre-signed URLs expire after 7 days (configurable via `PRESIGNED_URL_EXPIRY_SECONDS`)
- All endpoints require the caller to be internal (no public-facing auth on this service — it sits behind the internal network)
- Do not expose this service's port externally; route through case-service or admin portal only

## Legal Disclaimer

All statute citations in generated packs are derived from a curated database and Claude AI analysis. They **must** be independently verified by a licensed attorney before reliance in any legal proceeding. This service is a work-product tool, not a substitute for legal advice.

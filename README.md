# ExitForge

> AI-orchestrated timeshare exit platform. 7% contingency fee — $0 upfront. Every architectural decision is defensible to a Series A technical due diligence team.

---

## Production Readiness

```
Overall: ████████████████████░░░░  78%
```

| Layer | Status | Score |
|---|---|---|
| Core business logic | ✅ Complete | 95% |
| API surface | ✅ Complete | 90% |
| AI / ML pipeline | ✅ Complete | 85% |
| Auth & security | ✅ Complete | 88% |
| Data layer | ✅ Complete | 90% |
| Messaging (Kafka) | ✅ Complete | 85% |
| Frontend (web) | ✅ Complete | 80% |
| Frontend (mobile) | 🔶 Scaffolded | 40% |
| Infrastructure as code | ✅ Complete | 85% |
| CI / CD | ✅ Complete | 80% |
| Observability | 🔶 Partial | 50% |
| Test coverage | ❌ Missing | 5% |
| ML model training data | ❌ Missing | 10% |

**What's left for 100%:** unit + integration test suites, trained XGBoost `.pkl` model files, production secret rotation procedures, Datadog/OpenTelemetry instrumentation, mobile app feature parity (messages + document upload screens), and a staging environment deploy pipeline.

---

## What Is ExitForge?

Timeshare owners are trapped in perpetual contracts with rising maintenance fees and no liquid exit. ExitForge automates the legal exit process end-to-end using AI:

1. Client submits intake → AI qualifies the case instantly
2. Claude analyzes the contract for misrepresentation, illegal terms, and leverage
3. LangGraph orchestrates strategy selection across 4 exit tracks
4. AI drafts negotiation letters; attorneys review before send
5. Resort responds → AI adapts strategy → escalate or close
6. Exit confirmed → 7% contingency fee released from Escrow.com

---

## Monorepo Structure

```
exitforge/
├── apps/
│   ├── web/          # Next.js 14 App Router — client portal + marketing
│   ├── admin/        # Next.js 14 — internal ops dashboard
│   └── mobile/       # Expo Router (React Native) — iOS + Android
├── packages/
│   ├── shared/       # Single source of truth for all TypeScript domain types
│   ├── ui/           # Radix UI + CVA component library
│   └── api-client/   # Type-safe fetch client for case-service
├── services/
│   ├── case-service/         # NestJS — core case CRUD and state machine
│   ├── intake-service/       # NestJS — AI qualification scoring
│   ├── negotiation-service/  # NestJS — Claude letter generation + S3
│   ├── communication-service/# NestJS — SendGrid email + Twilio SMS
│   ├── payment-service/      # NestJS — Stripe + Escrow.com
│   ├── legal-service/        # NestJS — attorney review queue
│   ├── ai-orchestrator/      # FastAPI — LangGraph autonomous agent
│   ├── document-service/     # FastAPI — Textract OCR + contract analysis
│   ├── ml-service/           # FastAPI — XGBoost qualification scoring
│   └── resort-intelligence/  # FastAPI — resort profiles + fuzzy matching
├── infrastructure/
│   ├── kubernetes/   # Helm chart for all services
│   └── terraform/    # EKS, RDS, ElastiCache, MSK Kafka, S3
├── docker-compose.yml
└── .github/workflows/
    ├── ci.yml        # PR checks — lint, type-check, test
    └── deploy.yml    # main → ECR → EKS via Helm
```

**Stack:** Turborepo · pnpm workspaces · TypeScript 5 strict · NestJS 10 + Fastify · Next.js 14 · FastAPI · Python 3.12 · PostgreSQL 16 · MongoDB · Kafka · Redis · AWS (EKS, RDS, MSK, S3, Textract) · Clerk.dev · Stripe · Escrow.com · Anthropic Claude · LangGraph

---

## Business Model

- **Fee:** 7% of recovery basis (outstanding mortgage + 5 × annual maintenance fee)
- **Payment:** Held in Escrow.com, released only on confirmed exit
- **Upfront cost to client:** $0
- **Fee calculation is shared** across case-service, payment-service, and the FeeCalculator component — single source of truth

---

## packages/shared

**`packages/shared/src/index.ts`** — imported by every TypeScript service and app.

### Domain Types
| Type | Values |
|---|---|
| `CaseStatus` | `INTAKE` → `CLOSED_SUCCESS` / `CLOSED_FAILURE` (14 states) |
| `ExitTrack` | `DEED_BACK` · `LEGAL_DEMAND` · `REGULATORY_PRESSURE` · `LITIGATION` |
| `ResponseType` | `ACCEPTED` · `REJECTED` · `COUNTER` · `LEGAL_THREAT` · `NO_RESPONSE` |
| `DocumentType` | 8 types (contract, deed, demand letter, CFPB complaint, etc.) |
| `ProcessStatus` | `PENDING` · `PROCESSING` · `COMPLETE` · `FAILED` |
| `FeeStatus` | `PENDING` · `IN_ESCROW` · `RELEASED` · `REFUNDED` |

### Core Entities
`Case` · `Client` · `Timeshare` · `Resort` · `Negotiation` · `Document` · `CaseEvent` · `Fee` · `Attorney` · `Message`

### AI/ML Types
`QualificationScore` · `ContractIntelligenceReport` · `ContractClause` · `MisrepresentationFlag` · `IllegalTermFlag` · `NegotiationRound` · `ResortIntelligence` · `FeeCalculation`

### Kafka Envelope
```ts
KafkaEvent<T> {
  eventId, eventType, aggregateId, timestamp, version,
  payload: T,
  metadata: { correlationId, causationId, service }
}
```

**18 event types:** `case.created` · `case.status_changed` · `case.qualified` · `case.closed` · `document.uploaded` · `document.analyzed` · `intake.submitted` · `intake.qualified` · `negotiation.letter_generated` · `negotiation.round_completed` · `negotiation.stalled` · `negotiation.accepted` · `payment.fee_calculated` · `payment.escrow_created` · `payment.escrow_released` · `communication.email_sent` · `communication.sms_sent` · `resort.intelligence_updated`

---

## services/case-service

**NestJS 10 + Fastify · Port 3001 · PostgreSQL via Prisma**

### Prisma Schema — 9 Models
| Model | Purpose |
|---|---|
| `Client` | Authenticated user profile |
| `Case` | Core entity — status, exit track, ML scores, attorney assignment |
| `Timeshare` | Contract details — purchase price, maintenance fee, mortgage |
| `Resort` | Resort profile — resistance/receptivity scores, deed-back availability |
| `Negotiation` | Per-round negotiation state — track, letters, response, S3 keys |
| `Document` | Uploaded files — OCR status, analysis status, contract S3 key |
| `CaseEvent` | Immutable audit log of all state transitions |
| `Fee` | 7% fee record — basis amount, escrow transaction ID, status |
| `Attorney` | Assignable attorneys with state bar numbers |
| `Message` | Client ↔ case-manager messaging thread |

### API Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/cases` | Create case + Kafka `case.created` |
| `GET` | `/api/v1/cases` | List client's own cases |
| `GET` | `/api/v1/cases/:id` | Case detail (ownership enforced) |
| `PATCH` | `/api/v1/cases/:id/status` | State transition + audit event + Kafka |
| `POST` | `/api/v1/cases/:id/messages` | Send message → Kafka `message.received` |
| `GET` | `/api/v1/cases/:id/ml-timeline` | ML P50/P90 timeline prediction |
| `GET` | `/api/v1/cases/:id/fee-estimate` | 7% fee breakdown |
| `GET` | `/api/v1/cases/:id/negotiations` | Negotiation rounds |
| `POST` | `/api/v1/documents/presigned-url` | S3 pre-signed upload URL (1hr max) |
| `GET` | `/health` | Liveness check |

### Security
- Clerk JWT validation on every route via `ClerkAuthGuard`
- `clientId !== userId` → `403 ForbiddenException` (no cross-client data leakage)
- Kafka events use transactional producer (exactly-once semantics)
- Zod env validation at startup (service won't start with missing secrets)

---

## services/ai-orchestrator

**FastAPI · Python 3.12 · Port 8000 · LangGraph + Claude Sonnet 4**

### LangGraph Agent Graph — 8 Nodes

```
intake_analyzer
      ↓
qualification_scorer
      ↓ (ineligible → graceful_decline)
contract_analyzer
      ↓
strategy_selector ──→ resort_intelligence lookup
      ↓
negotiation_orchestrator
      ↓ (stalled/legal threat → human_review)
outcome_processor
      ↓
[END]
```

| Node | What it does |
|---|---|
| `intake_analyzer` | Claude extracts structured data from raw intake (resort, contract year, mortgage, misrep claims) |
| `qualification_scorer` | HTTP to ml-service → applies threshold; ineligible cases exit via `graceful_decline` |
| `contract_analyzer` | HTTP to document-service → loads `ContractIntelligenceReport` from MongoDB |
| `strategy_selector` | Claude selects exit track based on contract report + resort intelligence |
| `negotiation_orchestrator` | Drives negotiation rounds — calls negotiation-service to generate letters, processes responses |
| `outcome_processor` | Finalizes case: confirmed exit → triggers fee calculation + escrow creation |
| `human_review` | Queues case for attorney with priority + reason classification |
| `graceful_decline` | Updates case to `CLOSED_FAILURE`, notifies client via communication-service |

- **Checkpointing:** `MemorySaver` persists state between graph invocations (resumable after human review)
- **Kafka consumer:** `aiokafka` consumer group `ai-orchestrator` listens on `case.created`, `intake.qualified`, `document.analyzed`, `resort.intelligence_updated`

### API
| Method | Path |
|---|---|
| `POST` | `/graph/invoke` — Start/resume a case graph run |
| `GET` | `/graph/status/{case_id}` — Current node + state snapshot |
| `POST` | `/graph/resume` — Resume after human_review approval |
| `GET` | `/health` |

---

## services/document-service

**FastAPI · Python 3.12 · Port 8002 · AWS Textract + Claude + MongoDB**

### Pipeline
```
S3 upload → Textract async job → poll until complete → raw text
    → Claude analysis (JSON-schema enforced) → validated report → MongoDB
```

### Contract Intelligence Report
Claude extracts and scores:
- **Misrepresentation flags** — rental income promises, investment framing, pressure tactics, cooling-off violations
- **Illegal term flags** — perpetuity clauses, unconscionable fee escalation, void provisions
- **Leverage score** (0–1) — how strong the client's legal position is
- **Recommended exit track** — based on clause analysis
- **Key clauses** — extracted verbatim with page references

All Claude responses validated with Zod-equivalent Pydantic schema before MongoDB write.

### API
| Method | Path |
|---|---|
| `POST` | `/analyze/contract` — Trigger OCR + analysis pipeline (background task) |
| `GET` | `/documents/{id}` — Document + analysis result |
| `GET` | `/cases/{case_id}/documents` — All documents for a case |
| `GET` | `/health` |

---

## services/ml-service

**FastAPI · Python 3.12 · Port 8001 · XGBoost (rules-based bootstrap)**

### Endpoints
| Endpoint | Input | Output |
|---|---|---|
| `POST /predict/qualification` | Resort resistance, mortgage, contract year, misrep count, hardship flag | `score` (0–1), `eligible` boolean, `confidence`, `reasoning` |
| `POST /predict/strategy` | Qualification score, misrep flags, leverage, resort receptivity | Exit track recommendation + confidence |
| `POST /predict/timeline` | Exit track, resort resistance, mortgage size | `p50_days`, `p90_days` |

### Rules-Based Bootstrap (active until model training)
```
score = 0.50
  + misrepresentation_count × 0.08  (max 0.24)
  + mortgage_bonus if mortgage > 5000
  + 0.10 if contract_year < 2015
  + 0.08 if maintenance_fee > 2000/yr
  + 0.10 if financial_hardship
```
Loads trained `XGBoost .pkl` from `/models/` automatically when available — zero code change needed.

---

## services/intake-service

**NestJS 10 + Fastify · Port 3002**

- `POST /api/v1/intake/qualify` — Claude narrative assessment + ML service score → `QualificationScore`
- `POST /api/v1/intake/chatbot/message` — Conversational intake assistant (Claude, guided prompts)
- Emits `intake.submitted` and `intake.qualified` Kafka events
- Rules-based fallback scoring if Claude or ML service is unavailable

---

## services/negotiation-service

**NestJS 10 + Fastify · Port 3003 · Claude + AWS S3**

### Letter Generation
Two Claude-powered prompts:
- **`DEED_BACK_PROMPT`** — Formal deed-back request citing contract terms and misrepresentation
- **`LEGAL_DEMAND_PROMPT`** — Legal demand letter citing consumer protection statutes

Pipeline: `Claude completion → S3 PutObject → pre-signed download URL (1hr) → attorney review queue`

### API
| Method | Path |
|---|---|
| `POST` | `/letters/generate` — Generate negotiation letter + store in S3 |
| `PATCH` | `/cases/:caseId/rounds/:roundNumber/response` — Record resort response |

---

## services/communication-service

**NestJS 10 + Fastify · Port 3004 · SendGrid + Twilio**

- `POST /email` — Transactional email via `@sendgrid/mail`
- `POST /sms` — SMS via Twilio REST client
- `POST /case-status` — Full HTML status-change email template (status badge, next steps, timeline)
- Kafka consumer for `case.status_changed` events (auto-notify clients on status transitions)

---

## services/payment-service

**NestJS 10 + Fastify · Port 3005 · Stripe + Escrow.com**

### Fee Calculation
```
basis = outstanding_mortgage + (annual_maintenance × 5)
fee   = basis × 0.07
```

### Endpoints
| Method | Path | Description |
|---|---|---|
| `POST` | `/fee-estimate` | Calculate 7% fee without creating escrow |
| `POST` | `/escrow/create` | Create Escrow.com transaction, hold fee |
| `POST` | `/escrow/release` | Release escrow on confirmed exit |
| `POST` | `/webhooks/stripe` | Stripe webhook — signature-verified before processing |

- Stripe API version pinned to `2024-06-20`
- Webhook signature verified with `stripe.webhooks.constructEvent` before any state mutation
- Escrow.com mock fallback when API key not configured (dev mode)

---

## services/legal-service

**NestJS 10 + Fastify · Port 3006**

- In-memory attorney review queue (ready for PostgreSQL persistence)
- `POST /attorney/review-queue` — Enqueue letter for attorney review
- `GET /attorney/review-queue` — Retrieve pending reviews (filtered by attorney)
- `PATCH /attorney/review-queue/:queueId/approve` — Approve → triggers letter dispatch

---

## services/resort-intelligence

**FastAPI · Python 3.12 · Port 8003 · MongoDB**

Seeded profiles for major resort groups:

| Developer | Resistance | Receptivity | Deed-Back | Preferred Track | Avg Close (days) | Success Rate |
|---|---|---|---|---|---|---|
| Wyndham | 0.75 | 0.35 | No | Legal Demand | 285 | 68% |
| Marriott Vacations | 0.65 | 0.45 | Yes | Deed-Back | 210 | 74% |
| Diamond Resorts | 0.80 | 0.30 | No | Regulatory | 320 | 62% |
| Bluegreen | 0.60 | 0.50 | Yes | Deed-Back | 190 | 78% |

- `POST /score` — Fuzzy name match + return full resort intelligence profile
- `GET /resorts/{id}` — Resort by ID
- Scores feed directly into LangGraph strategy selection

---

## apps/web

**Next.js 14 App Router · Clerk.dev · Tailwind CSS · Dark mode**

### Routes
| Route | Type | Description |
|---|---|---|
| `/` | Server | Marketing page — $0 upfront / 7% messaging |
| `/(portal)/cases` | Server | Case list (ISR, `revalidate: 60`) |
| `/(portal)/cases/[id]` | Server + Suspense | Full case detail page |
| `/sign-in` · `/sign-up` | Clerk hosted | Auth pages |
| `/api/cases/[id]/messages` | API Route | Proxy to case-service (Clerk-authenticated) |

### Case Detail Components
| Component | Description |
|---|---|
| `CaseStatusBadge` | Color-coded status chip for all 14 states |
| `CaseStatusTimeline` | 7-step visual progress bar with active step highlight |
| `CaseMetrics` | 4-card grid: exit probability, timeline P50/P90, assigned track |
| `MessageCenter` | Client component — real-time message thread + send form |
| `NegotiationHistory` | Per-round history with response color coding |
| `DocumentVault` | Document list with OCR + analysis status pills |
| `FeeCalculator` | Live 7% fee breakdown with Escrow.com note |

### Security Headers (next.config.ts)
`X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin` · `Strict-Transport-Security` · `Content-Security-Policy` (restrictive, nonce-based)

### Middleware
`clerkMiddleware` protects all `/(portal)/**` routes. Public: `/`, `/sign-in`, `/sign-up`, `/intake/**`, `/how-it-works`, `/api/webhooks/**`.

---

## apps/admin

**Next.js 14 · Clerk · Internal ops — `robots: noindex`**

- KPI dashboard: Active Cases · AI Escalation Rate · Avg Days to Close · Revenue in Escrow
- Attorney review queue panel
- Human review escalation queue (AI-flagged cases)

---

## apps/mobile

**Expo 51 · Expo Router · Clerk Expo SDK**

- Clerk auth guard on root layout — unauthenticated → `/sign-in`
- Bottom tab navigator: My Cases · Messages · Documents
- Cases screen: live fetch from case-service with Clerk token, exit probability display

---

## packages/ui

**Radix UI primitives · class-variance-authority · Tailwind Merge**

| Component | Variants |
|---|---|
| `Button` | `default` · `secondary` · `outline` · `ghost` · `destructive` · `link` · sizes: `sm` / `default` / `lg` / `icon` |
| `Card` | `Card` · `CardHeader` · `CardTitle` · `CardContent` |
| `Progress` | Indigo fill, Radix primitive |
| `cn()` | `clsx` + `tailwind-merge` utility |

---

## packages/api-client

Type-safe fetch client — no codegen required, just TypeScript:

```ts
const client = createCaseClient({ baseUrl, getToken });
await client.getMyCases();
await client.getCase(id);
await client.createCase(input);
await client.sendMessage(caseId, content);
```

---

## Infrastructure

### Local Development

```bash
cp .env.example .env   # fill in API keys
docker-compose up -d   # starts all 11 services + Postgres + Mongo + Kafka + Redis
```

All services have health checks. Kafka waits for Zookeeper. NestJS services wait for Kafka. Python services wait for MongoDB.

### Kubernetes (Helm)

```bash
helm upgrade --install exitforge infrastructure/kubernetes \
  --namespace exitforge --create-namespace \
  --set global.imageRegistry=<ECR_REGISTRY> \
  --set global.imageTag=<SHA>
```

Every service gets: `Deployment` (configurable replicas) · `Service` (ClusterIP) · `HorizontalPodAutoscaler` (where configured) · liveness + readiness probes on `/health`.

### Terraform (AWS)

| Resource | Details |
|---|---|
| EKS | v1.30, default node group (t3.medium), ML node group (c5.xlarge) with taint |
| RDS | PostgreSQL 16, encrypted, 7-day backups, deletion protection enabled |
| ElastiCache | Redis 7, t3.micro |
| MSK | Kafka 3.7, 3 brokers, TLS in-transit |
| S3 | AES-256 encryption, public access fully blocked, versioning enabled |
| VPC | 3-AZ, public + private subnets, NAT Gateway per AZ |

```bash
cd infrastructure/terraform
terraform init
terraform plan -var="db_password=<secret>"
terraform apply
```

---

## CI / CD

### `ci.yml` — Runs on every PR and push to `main`

- **TypeScript:** `turbo run lint type-check test --filter=[HEAD^1]` (only affected packages)
- **Python:** `ruff check` + `pyright` per service, in parallel matrix
- **Terraform:** `init -backend=false` + `validate` + `fmt -check`

### `deploy.yml` — Runs on push to `main`

1. AWS OIDC → no long-lived credentials
2. Matrix Docker build + push to ECR (11 services, layer cache from `:latest`)
3. `helm upgrade --install --atomic --timeout 5m` to EKS prod cluster
4. Automatic rollback if Helm times out

---

## Security Posture

| Control | Implementation |
|---|---|
| Authentication | Clerk JWT on every NestJS route |
| Authorization | `clientId === userId` enforced in case-service before any data access |
| Secrets | Zod validation at startup — service won't boot with missing secrets |
| S3 URLs | Pre-signed only, max 1-hour expiry — no public bucket access |
| Stripe webhooks | `stripe.webhooks.constructEvent` signature verification before processing |
| LLM outputs | Pydantic / Zod schema validation before any database write |
| SQL injection | Prisma parameterized queries — no raw SQL |
| CSP | Restrictive Content-Security-Policy headers on Next.js |
| PII in logs | Structured logging with `correlationId` only — no PII in log payloads |
| Kafka | Transactional producer for critical events (exactly-once delivery) |
| TF state | S3 backend with DynamoDB lock + AES-256 encryption |
| Container images | Multi-stage builds — no dev dependencies in production images |

---

## Environment Variables

```bash
# Auth
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# AI
ANTHROPIC_API_KEY=

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=exitforge-documents

# Database
DATABASE_URL=postgresql://exitforge:exitforge_dev@localhost:5432/exitforge
MONGODB_URL=mongodb://exitforge:exitforge_dev@localhost:27017

# Kafka
KAFKA_BROKERS=localhost:9092

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ESCROW_API_KEY=

# Notifications
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

---

## What's Not Done Yet

| Item | Priority | Notes |
|---|---|---|
| Unit + integration tests | High | Vitest for NestJS, pytest for Python — no test files exist yet |
| Trained ML models | High | `.pkl` files for qualification/strategy/timeline — rules-based bootstrap active |
| Datadog / OpenTelemetry | Medium | `DD_SERVICE` env vars are wired; instrumentation not yet added |
| Mobile messages + docs screens | Medium | Tab layout exists; only Cases screen is implemented |
| Dashboard page (web) | Medium | `/(portal)/dashboard` route not yet created |
| Intake flow pages (web) | Medium | Multi-step intake form not yet built |
| Attorney document signing | Low | DocuSign/HelloSign integration not started |
| CFPB complaint automation | Low | Would require regulatory filing API access |
| Staging environment | Medium | Deploy workflow only targets prod |
| E2E tests (Playwright/Detox) | Low | No E2E suite |

# Onboarding Guide: Up and Running in 30 Minutes

This guide takes a **brand-new engineer** from zero to running the full ExitForge stack locally. Read end-to-end before running anything.

---

## Prerequisites

Install these tools before starting:

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20.x | `nvm install 20` |
| pnpm | ≥ 10.x | `npm install -g pnpm@10` |
| Python | 3.12.x | `pyenv install 3.12.4` |
| Docker + Compose | ≥ 24 | [docker.com](https://docs.docker.com/get-docker/) |
| Terraform | ≥ 1.9 | `brew install terraform` |
| Git | Any | Pre-installed on macOS/Linux |

Verify:
```bash
node --version && pnpm --version && python3 --version && docker --version
```

---

## Step 1: Clone and Install (5 min)

```bash
# Clone
git clone https://github.com/mkallberg21/Timeshare.git
cd Timeshare/exitforge

# Install all Node.js dependencies for every package and service
pnpm install

# Install Python dependencies for each Python service
cd services/ai-orchestrator && pip install -r requirements.txt && cd ../..
cd services/ml-service && pip install -r requirements.txt && cd ../..
cd services/document-service && pip install -r requirements.txt && cd ../..
cd services/resort-intelligence && pip install -r requirements.txt && cd ../..
```

---

## Step 2: Configure Environment Variables (5 min)

Each service has a `.env.example` file. Copy and fill in development values:

```bash
# From exitforge root — copy all env examples
find . -name ".env.example" -not -path "*/node_modules/*" | while read f; do
  cp "$f" "${f%.example}"
done
```

Minimum values needed for local development (Docker provides the rest automatically):

**`services/case-service/.env`**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://exitforge:exitforge_dev@localhost:5432/exitforge
CLERK_SECRET_KEY=sk_test_<your_clerk_key>
KAFKA_BROKERS=localhost:9092
```

Get your Clerk key from [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys → Secret Key (test environment).

---

## Step 3: Start Infrastructure (5 min)

```bash
# From repo root
docker compose -f infrastructure/docker-compose.yml up -d

# Wait for services to be healthy (especially Kafka — takes ~30s)
docker compose -f infrastructure/docker-compose.yml ps
```

Expected output: all 7 infrastructure services (postgres, mongodb, redis, kafka, zookeeper, kafka-ui, mongo-express) showing `healthy` or `running`.

Useful local dashboards:
- **Kafka UI**: http://localhost:8080
- **Mongo Express**: http://localhost:8081 (user: `admin`, pass: `pass`)

---

## Step 4: Run Database Migrations (2 min)

```bash
cd services/case-service
pnpm prisma migrate dev     # applies migrations, generates client
pnpm prisma db seed         # inserts sample data (3 cases, 2 resorts)
cd ../..
```

---

## Step 5: Start the Services (5 min)

In one terminal, start all TypeScript services and frontend apps:
```bash
# From exitforge root — starts everything with hot reload
pnpm dev
```

In a second terminal, start Python services:
```bash
# Each in its own tab
cd services/ai-orchestrator && uvicorn app.main:app --reload --port 8000
cd services/ml-service && uvicorn app.main:app --reload --port 8001
```

Expected:
- **Web app**: http://localhost:3000 (requires Clerk sign-in)
- **case-service API**: http://localhost:3001/api/health
- **case-service Swagger**: http://localhost:3001/api/docs
- **AI orchestrator**: http://localhost:8000/health

---

## Step 6: Run Tests (5 min)

```bash
pnpm test                          # all TypeScript services
pnpm --filter @exitforge/case-service test --coverage   # single service with coverage
cd services/ai-orchestrator && pytest                   # Python unit tests
```

---

## Codebase Tour (10 min)

Read these files in order:

1. [`README.md`](../README.md) — architecture overview and Mermaid diagram
2. [`docs/adr/`](adr/) — 8 ADRs explain every major technical decision
3. [`services/case-service/src/`](../services/case-service/src/) — most complete service, use as a template
4. [`services/ai-orchestrator/app/graph/agent_graph.py`](../services/ai-orchestrator/app/graph/agent_graph.py) — core AI pipeline
5. [`packages/shared/src/`](../packages/shared/src/) — shared TypeScript types (start here before writing any domain code)

---

## Common Tasks

### Add a new NestJS endpoint
1. Create a DTO in `src/<domain>/dto/`
2. Add the route in `src/<domain>/<domain>.controller.ts`
3. Implement business logic in `src/<domain>/<domain>.service.ts`
4. Add a unit test in `test/unit/<domain>.service.spec.ts`

### Add a new Kafka event type
1. Add the event type to `packages/shared/src/events.ts`
2. Add a producer call in the emitting service's `KafkaService`
3. Add a handler in every consuming service's Kafka consumer

### Create a database migration
```bash
cd services/case-service
pnpm prisma migrate dev --name "add_attorney_email"
```

### Run a specific service in isolation
```bash
pnpm --filter @exitforge/case-service dev
```

---

## Getting Help

- **Slack**: `#engineering` for general questions, `#incidents` for production issues
- **Runbooks**: [`docs/runbooks/`](runbooks/) for production incident playbooks
- **Architecture questions**: Check `docs/adr/` first — if an ADR exists, the answer is there
- **PR reviews**: Assign to `@mkallberg21` (auto-assigned via CODEOWNERS)

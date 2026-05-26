# case-service

The core domain service. Owns the `Case`, `Client`, `Timeshare`, `Resort`, `Negotiation`, `Fee`, `Document`, `CaseEvent`, `Attorney`, and `Message` models in PostgreSQL.

All other services are consumers of case events — this is the system of record for case state.

## Responsibilities

- CRUD for cases, clients, and associated entities
- Case state machine transitions (validated server-side)
- Fee calculation (7% contingency model)
- Emitting `case.*` Kafka events on every state change
- Providing an HTTP API consumed by `apps/web` and `apps/admin`

## API

Swagger docs available at `http://localhost:3001/api/docs` when running locally.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/cases` | Create new case (requires auth) |
| `GET` | `/api/cases` | List cases for authenticated user |
| `GET` | `/api/cases/:id` | Get case detail |
| `PATCH` | `/api/cases/:id/status` | Update case status (internal only) |
| `POST` | `/api/cases/:id/messages` | Send message on a case |
| `GET` | `/api/cases/:id/messages` | Get case message history |
| `GET` | `/health` | Health check |

## Local Setup

```bash
# Install dependencies (from repo root)
pnpm install

# Copy env
cp .env.example .env
# Edit .env with your Clerk key

# Start Postgres (from repo root)
docker compose -f infrastructure/docker-compose.yml up -d postgres

# Run migrations and seed data
pnpm prisma migrate dev
pnpm prisma db seed

# Start the service
pnpm dev
```

## Running Tests

```bash
pnpm test              # unit tests
pnpm test:integration  # integration tests (requires Postgres + Kafka)
pnpm test:e2e          # end-to-end tests
pnpm test --coverage   # with coverage report
```

## Kafka Events Produced

| Topic | Event Type | Trigger |
|---|---|---|
| `case.events` | `case.created` | New case submitted |
| `case.events` | `case.status_changed` | Any status transition |
| `case.events` | `case.message_sent` | New message added |

## Environment Variables

See [`docs/environment-variables.md`](../../docs/environment-variables.md#case-service-port-3001) for full reference.

## Dependencies

- **PostgreSQL** — Primary datastore (Prisma ORM)
- **Kafka** — Event publishing
- **Clerk** — JWT validation on every request
- **ml-service** — Called directly for document analysis scoring

# Environment Variables Reference

All services read configuration from environment variables. This document describes every variable across every service.

**In production**, all secrets are stored in AWS Parameter Store. Never commit `.env` files.  
**For local development**, copy `.env.example` to `.env` in each service directory.

---

## Global Variables (all services)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` / `APP_ENV` | Yes | `development` | Runtime environment: `development`, `staging`, `production` |
| `LOG_LEVEL` | No | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |

---

## case-service (port 3001)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3001) | HTTP port |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/exitforge` |
| `KAFKA_BROKERS` | **Yes** | Comma-separated Kafka broker addresses. Local: `localhost:9092` |
| `KAFKA_CLIENT_ID` | No (default: `case-service`) | Kafka producer client identifier |
| `KAFKA_GROUP_ID` | No (default: `case-service-group`) | Kafka consumer group |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key. Get from [dashboard.clerk.com](https://dashboard.clerk.com) → API Keys |
| `CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk publishable key. Same location as above |
| `ML_SERVICE_URL` | **Yes** | Internal URL for ml-service. Local: `http://localhost:8001` |

---

## intake-service (port 3002)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3002) | HTTP port |
| `DATABASE_URL` | **Yes** | Same PostgreSQL instance as case-service |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key |

---

## negotiation-service (port 3003)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3003) | HTTP port |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key for letter generation. Get from [console.anthropic.com](https://console.anthropic.com) |

---

## communication-service (port 3004)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3004) | HTTP port |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key |
| `SENDGRID_API_KEY` | **Yes** | SendGrid API key for transactional email |
| `SENDGRID_FROM_EMAIL` | **Yes** | Verified sender address (e.g., `noreply@exitforge.com`) |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID for SMS notifications |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio phone number |

---

## payment-service (port 3005)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3005) | HTTP port |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key |
| `STRIPE_SECRET_KEY` | **Yes** | Stripe secret key. Get from [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | Stripe webhook signing secret. Get from Stripe dashboard → Webhooks → Signing secret |
| `ESCROW_API_KEY` | **Yes** | Escrow.com API key. Get from [escrow.com](https://www.escrow.com) developer portal |
| `ESCROW_API_BASE_URL` | No (default: `https://api.escrow.com/2017-09-01`) | Override for sandbox: `https://api.sandbox.escrow.com/2017-09-01` |

---

## legal-service (port 3006)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3006) | HTTP port |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key |
| `AWS_REGION` | **Yes** | AWS region for S3 document storage. Default: `us-east-1` |
| `AWS_S3_BUCKET` | **Yes** | S3 bucket name for legal documents |
| `AWS_ACCESS_KEY_ID` | Prod: No (IRSA) / Dev: **Yes** | AWS access key for local dev. In production, use IRSA |
| `AWS_SECRET_ACCESS_KEY` | Prod: No (IRSA) / Dev: **Yes** | AWS secret key for local dev |

---

## document-service (port 3007, Python)

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No (default: `development`) | Runtime environment |
| `PORT` | No (default: 3007) | HTTP port |
| `MONGODB_URL` | **Yes** | MongoDB connection string. Local: `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | No (default: `exitforge_documents`) | MongoDB database name |
| `KAFKA_BROKERS` | **Yes** | Comma-separated Kafka broker addresses |
| `AWS_REGION` | **Yes** | AWS region for S3 |
| `AWS_S3_BUCKET` | **Yes** | S3 bucket for document uploads |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key for contract analysis |

---

## ml-service (port 8001, Python)

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No (default: `development`) | Runtime environment |
| `PORT` | No (default: 8001) | HTTP port |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |

---

## ai-orchestrator (port 8000, Python)

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | No (default: `development`) | Runtime environment |
| `PORT` | No (default: 8000) | HTTP port |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key for Claude claude-sonnet-4 |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |
| `KAFKA_TOPIC_CASE_EVENTS` | No (default: `case.events`) | Topic for case event consumption |
| `REDIS_URL` | **Yes** | Redis URL for LangGraph `MemorySaver`. Local: `redis://localhost:6379` |
| `CASE_SERVICE_URL` | **Yes** | Internal URL for case-service. Local: `http://localhost:3001` |

---

## resort-intelligence (port 3008)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3008) | HTTP port |
| `MONGODB_URL` | **Yes** | MongoDB connection string |
| `MONGODB_DB_NAME` | No (default: `exitforge_resorts`) | MongoDB database name |
| `KAFKA_BROKERS` | **Yes** | Kafka broker addresses |

---

## apps/web (Next.js)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk publishable key (exposed to browser) |
| `CLERK_SECRET_KEY` | **Yes** | Clerk secret key (server-side only) |
| `NEXT_PUBLIC_API_URL` | **Yes** | Base URL for API calls from the browser. Local: `http://localhost:3001` |
| `NEXT_PUBLIC_APP_ENV` | No | Passed to analytics/logging. Values: `development`, `staging`, `production` |

---

## Notes

- Variables prefixed `NEXT_PUBLIC_` are **exposed to the browser**. Never put secrets in them.
- In production, `DATABASE_URL` includes credentials — set it via AWS Parameter Store, not in code.
- `ANTHROPIC_API_KEY` is used by 3 services. In production, all 3 read from `/exitforge/prod/shared/ANTHROPIC_API_KEY`.
- Stripe test mode uses keys prefixed `sk_test_`. Production uses `sk_live_`.

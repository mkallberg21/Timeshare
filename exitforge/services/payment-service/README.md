# payment-service

Handles all financial operations: Stripe payment collection and Escrow.com fee holding.

## Responsibilities

- Creates Stripe PaymentIntents when a case reaches `FEE_CALCULATED` status
- Verifies Stripe webhook signatures before processing payment events
- Creates Escrow.com transactions to hold contingency fees until exit is confirmed
- Releases escrow when case transitions to `ESCROW_RELEASED`
- Emits `payment.*` Kafka events

## Fee Calculation

```
basis  = outstanding_mortgage + (annual_maintenance_fee × 5)
fee    = basis × 0.07   (7% contingency)
```

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/payments/initiate` | Create PaymentIntent + Escrow transaction |
| `POST` | `/payments/webhook` | Stripe webhook receiver (signature verified) |
| `POST` | `/payments/escrow/release` | Release escrow on successful exit |
| `GET` | `/health` | Health check |

## Local Setup

```bash
pnpm install
cp .env.example .env
# Add Stripe test keys and Escrow.com sandbox keys
pnpm dev
```

For Stripe webhooks locally, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3005/payments/webhook
```

## Environment Variables

See [`docs/environment-variables.md`](../../docs/environment-variables.md#payment-service-port-3005) for full reference.

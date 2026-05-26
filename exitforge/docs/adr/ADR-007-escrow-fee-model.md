# ADR-007: 7% Contingency Fee Model Requires Escrow Architecture

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** CEO, Engineering Leadership, Legal Counsel  

---

## Context

ExitForge charges a 7% contingency fee only on successful timeshare exit. This creates a specific legal and technical requirement: money cannot move directly from client to ExitForge before exit is confirmed. Regulatory risk (resemblance to advance-fee fraud schemes common in the timeshare exit industry) requires that fees be held by a neutral third party until exit is verifiably complete.

## Decision

Use **Escrow.com** to hold all contingency fees from collection to confirmed exit.

Fee calculation:
```
basis  = outstanding_mortgage + (annual_maintenance_fee × 5)
fee    = basis × 0.07
```

The fee is a basis-of-value calculation, not a fixed amount. `payment-service` creates the Escrow.com transaction when a case enters `FEE_CALCULATED` status. The fee is released when the case transitions to `ESCROW_RELEASED`.

This architecture has cascading effects on system design:
- `payment-service` must integrate Escrow.com REST API
- Case state machine must have `FEE_CALCULATED` and `ESCROW_RELEASED` as distinct states
- Stripe is used only for client payment initiation (funding the escrow transaction)
- `payment.escrow_created` and `payment.escrow_released` are first-class Kafka events

## Consequences

### Positive
- Legally defensible against advance-fee fraud allegations — client money never touches ExitForge accounts until exit is confirmed
- Escrow.com provides dispute resolution if client contests the exit
- Creates a natural audit trail: escrow transaction ID is stored on every `Fee` record
- Builds client trust — "$0 upfront" is backed by actual escrow, not a verbal promise

### Negative
- Escrow.com API is slow (up to 2s per call) — must be called asynchronously
- Escrow.com takes a fee (typically 0.89% of transaction value) — reduces ExitForge margin
- Integration adds complexity: two payment systems (Stripe for collection, Escrow.com for holding)
- Mock/sandbox Escrow.com environment is limited — integration tests must mock the HTTP layer
- Fee release requires a signed attestation that exit is complete — must design the confirmation flow carefully

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Stripe only | Cannot hold funds in escrow for indeterminate periods without regulatory issues |
| Stripe Connect (escrow-like) | Not true third-party escrow; money still flows through ExitForge's Stripe account |
| Attorney trust accounts | Legally complex; requires attorney involvement in every transaction; not scalable |
| Pay after close (invoice) | Higher collection risk; clients may dispute after exit is confirmed |

# ADR-009: Real-time Transport — WebSocket vs SSE vs Polling

- **Status:** Accepted
- **Date:** 2025-05-26
- **Deciders:** Engineering Team

## Context

The ExitForge client portal requires real-time updates for:

1. Case status transitions (e.g. `INTAKE → QUALIFICATION → NEGOTIATION_ACTIVE`)
2. Incoming messages from AI agents and case managers
3. Live qualification score display during intake
4. Attorney review queue updates in the admin panel

We evaluated three approaches: WebSocket (Socket.IO), Server-Sent Events (SSE), and HTTP polling.

## Decision Drivers

- **Bidirectionality:** Clients need to subscribe to specific cases (join a room) — one-way SSE cannot achieve room semantics without per-case connections.
- **Infrastructure:** We already run an AWS ALB that supports WebSocket upgrades with sticky sessions disabled.
- **Scalability:** Must work horizontally across multiple pod replicas.
- **Client complexity:** Native browser `EventSource` API for SSE vs full socket.io client.
- **Firewall / proxy compatibility:** SSE has higher corporate firewall pass-through; WebSocket is widely supported.

## Options Considered

### Option A: HTTP Polling (rejected)

Long-poll or `setInterval` fetch every 5–30 s.

| Pro | Con |
|-----|-----|
| Zero infra complexity | High latency (up to 30 s lag) |
| No persistent connections | Wasted bandwidth on unchanged data |
| Works everywhere | Server load increases linearly with clients |

**Verdict:** Unacceptable user experience for negotiation-round updates.

### Option B: Server-Sent Events (SSE)

`Response.body` stream per client; reconnects automatically.

| Pro | Con |
|-----|-----|
| Works through HTTP/2 multiplexing | Unidirectional — client cannot subscribe to specific case rooms without per-case URLs |
| Native browser support, no library | Requires sticky sessions or a Redis pub/sub relay per SSE stream |
| Lightweight server implementation | No binary frames; text-only |

**Verdict:** Viable for admin dashboards but cannot cleanly model room-based subscriptions.

### Option C: WebSocket via Socket.IO (chosen)

Persistent full-duplex TCP/WS upgrade; Socket.IO adds rooms, reconnection, and namespace support.

| Pro | Con |
|-----|-----|
| Bidirectional — client can join/leave rooms | Library dependency (`socket.io`, `socket.io-client`) |
| Room semantics map 1:1 to `case:<id>` | Requires Redis adapter for multi-pod fan-out |
| NestJS `@nestjs/platform-socket.io` is first-class | WS upgrade blocked by some corporate proxies (rare) |
| Automatic reconnection with exponential backoff | Slightly higher memory per connection vs SSE |

## Decision

**WebSocket via Socket.IO** with the following architecture:

```
Client (socket.io-client)
  → connects to /cases namespace
  → emits "join:case", caseId
  → receives "case:updated" | "message:new" events

CasesGateway (@WebSocketGateway /cases)
  → server.to("case:<id>").emit(...)

Redis Adapter (socket.io-redis)
  → ensures events fan out across all pods
```

### Multi-Pod Horizontal Scaling

The `@socket.io/redis-adapter` package is added to case-service to distribute events across replicas:

```typescript
// In CasesModule or main.ts
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

This ensures that when pod A emits a `case:updated` event, all clients connected to pod B also receive it.

### Fallback

Socket.IO automatically falls back to HTTP long-polling for clients behind strict firewalls, providing graceful degradation without any application-level changes.

## Consequences

**Positive:**
- Sub-100 ms case update latency
- Room-based subscriptions eliminate polling load
- Native NestJS WebSocket decorators keep gateway code idiomatic
- Redis adapter enables zero-downtime rolling deploys

**Negative:**
- Redis adapter adds an operational dependency (already present for rate limiting + checkpointing)
- End-to-end test complexity slightly higher (requires a socket.io test client)
- Long-running WS connections must be tracked in the load balancer health check timeout

## Related

- [ADR-004 — Kafka for async events](ADR-004-kafka.md) (WebSocket handles client-facing push; Kafka handles service-to-service async)
- [CasesGateway](../../services/case-service/src/gateway/cases.gateway.ts)

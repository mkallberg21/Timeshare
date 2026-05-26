# ADR-002: NestJS over Express / Fastify for Backend Services

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** Engineering Leadership  

---

## Context

We need a Node.js framework for 6 backend microservices. Each service needs: dependency injection, validation, Swagger docs, health endpoints, and structured error handling.

## Decision

Use **NestJS 10** with the **Fastify adapter** for all TypeScript backend services.

NestJS provides an opinionated module system built on top of Fastify (for performance). The Fastify adapter gives ~20–30% higher throughput than Express with no code changes.

## Consequences

### Positive
- Dependency injection via `@Module` decorators eliminates manual wiring
- `ValidationPipe` + `class-validator` DTOs reject malformed requests at the boundary
- `@nestjs/swagger` auto-generates OpenAPI specs from decorators — no duplication
- Consistent `@Injectable` pattern makes every service trivially mockable in tests
- `ConfigModule.forRoot` + Zod validation provides guaranteed-valid config at startup
- `NestFactory.create(AppModule, new FastifyAdapter())` gives 2× Express throughput

### Negative
- Higher learning curve than Express for engineers unfamiliar with Angular-style DI
- Decorator-heavy syntax requires `emitDecoratorMetadata: true` in tsconfig (slightly unusual)
- Heavier boilerplate for simple endpoints vs raw Fastify

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Raw Express | No DI, no built-in validation, no Swagger integration — too much glue to write |
| Raw Fastify | Same as Express: no DI or module system |
| Hapi.js | Smaller ecosystem, fewer TypeScript integrations |
| tRPC | Requires coupling frontend and backend in same monorepo call graph — limits service independence |

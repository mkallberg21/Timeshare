# ADR-001: Monorepo with Turborepo over Polyrepo

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** Engineering Leadership  

---

## Context

ExitForge consists of 10 backend services, 3 frontend apps, and 3 shared packages. We need to decide how to organize these into one or multiple repositories.

Key constraints:
- Shared types between services must be kept in sync (a `CaseStatus` change must propagate atomically)
- The AI pipeline spans 3+ services; coordinated changes are frequent
- Small founding team — minimizing context-switching overhead is critical
- Need atomic commits that span services and shared packages

## Decision

Use a **monorepo managed by Turborepo** with pnpm workspaces.

All apps, services, and packages live under `exitforge/` in a single Git repository. Turborepo provides:
- Remote caching (TURBO_TOKEN) so CI only rebuilds affected packages
- Topologically correct task execution (`build` waits for `^build`)
- A `--filter` flag for targeted commands (`pnpm --filter @exitforge/case-service test`)

## Consequences

### Positive
- A single PR can atomically update `@exitforge/shared` types and every consumer
- `turbo run lint --filter=[HEAD^1]` in CI only runs lint on changed packages
- One `pnpm install` sets up every service for local development
- Refactoring across service boundaries is visible in a single diff

### Negative
- `git clone` downloads all code including services a developer may never touch
- Without discipline, services can start importing from each other directly — must enforce via ESLint `import/no-cycle`
- CI runs can be slow if remote cache is cold

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Polyrepo (one repo per service) | Coordinated type changes require N PRs; no atomic refactoring |
| Nx | More opinionated, larger footprint; Turborepo is sufficient for this scale |
| Bazel | Extreme operational complexity for a seed-stage startup |

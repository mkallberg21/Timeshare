# packages/

This directory contains shared packages consumed by services and apps within the monorepo. Packages are internal — not published to npm.

## Packages

| Package | Consumers | Description |
|---|---|---|
| [`shared`](shared/) | All TypeScript services and apps | Core TypeScript types, enums, and constants (CaseStatus, KafkaEvent, etc.) |
| [`ui`](ui/) | `apps/web`, `apps/admin` | Shared React component library (Button, Card, Progress) using Tailwind CSS |
| [`api-client`](api-client/) | `apps/web`, `apps/mobile` | Type-safe HTTP client factory for calling backend services |

## Dependency Rules

```
apps/*         → packages/shared, packages/ui, packages/api-client
services/*     → packages/shared
packages/ui    → packages/shared
packages/api-client → packages/shared
```

Services and packages **must not** import from `apps/*` or from other services.

ESLint `import/no-cycle` enforces that no circular dependency can exist within the monorepo.

## Adding a New Package

1. Create a directory under `packages/` with a `package.json` naming it `@exitforge/<name>`
2. Add a `tsconfig.json` extending `../../tsconfig.base.json`
3. Add an `src/index.ts` barrel file
4. Reference it from consuming packages via `"@exitforge/<name>": "workspace:*"`

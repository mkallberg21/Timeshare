# apps/

This directory contains user-facing applications built on the ExitForge platform.

## Applications

| App | Port | Framework | Audience |
|---|---|---|---|
| [`web`](web/) | 3000 | Next.js 14 App Router | Clients (timeshare owners seeking exit) |
| [`admin`](admin/) | 3001 (dev) | Next.js 14 App Router | ExitForge staff — case management dashboard |
| [`mobile`](mobile/) | Expo Go | React Native (Expo) | Clients on iOS/Android |

## Authentication

All apps use **Clerk.dev** for authentication:
- `web` and `admin` use `@clerk/nextjs` with the App Router
- `mobile` uses `@clerk/clerk-expo`

Protected routes in `web` are defined in `middleware.ts` — the pattern `/(portal)/**` requires authentication.

## Shared UI

The `packages/ui` package provides shared React components (Button, Card, Progress) used by both `web` and `admin`. The `apps/mobile` app uses native React Native components styled separately.

## Local Development

```bash
# Run all apps simultaneously
pnpm dev

# Run a single app
pnpm --filter @exitforge/web dev

# Build for production
pnpm --filter @exitforge/web build
```

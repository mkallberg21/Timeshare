# ADR-006: Clerk over Auth0 / AWS Cognito

**Status:** Accepted  
**Date:** 2025-01-01  
**Deciders:** Engineering Leadership  

---

## Context

We need authentication for a B2C product with:
- Email/password and OAuth (Google) sign-in
- Mobile app support (Expo)
- JWT tokens that NestJS services can validate without an outbound network call
- Prebuilt UI components so the frontend team doesn't build login screens
- Fast iteration — seed stage, not time to build auth infrastructure

## Decision

Use **Clerk.dev** for authentication across all surfaces (web, admin, mobile).

Clerk provides `@clerk/nextjs`, `@clerk/clerk-expo`, and publishes JWKS endpoints that NestJS services use to verify tokens offline.

## Consequences

### Positive
- `<SignIn />` and `<SignUp />` components work out of the box with zero UI work
- `auth()` server function in Next.js App Router provides the authenticated user in RSC with one line
- `ClerkAuthGuard` in NestJS validates JWT against Clerk's JWKS endpoint — no database call per request
- Clerk Expo SDK handles biometric auth and secure token storage on mobile
- User management dashboard (ban, impersonate, view sessions) is free
- Built-in MFA, bot protection, and brute-force rate limiting

### Negative
- Vendor dependency — if Clerk raises prices or has an outage, auth is affected
- Cannot self-host (unlike Auth0 on-prem)
- JWKS refresh requires cache invalidation on key rotation (handled by `jwks-rsa` library)
- Advanced RBAC requires Clerk Organizations (additional cost tier)

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Auth0 | 3× the price at scale; more complex configuration; similar vendor dependency |
| AWS Cognito | Poor developer experience; complex user pool configuration; mobile SDK is dated |
| NextAuth.js | Session-based only; NestJS services would need to call back to web app to validate — not viable for microservices |
| Custom JWT | Weeks of security-critical work; session management, refresh tokens, brute-force protection — not worth it at seed stage |
| Supabase Auth | Tied to Supabase database; we use PostgreSQL separately |

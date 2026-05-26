## Description

<!-- What does this PR do? Why is this change needed? Link to issue/ticket if applicable. -->

Closes #

---

## Type of Change

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `refactor` — No behavior change
- [ ] `perf` — Performance improvement
- [ ] `test` — Tests only
- [ ] `docs` — Documentation only
- [ ] `chore` — Tooling/dependencies/config
- [ ] `ci` — GitHub Actions changes

**Scope** (select one): `case-service` `intake-service` `negotiation-service` `communication-service` `payment-service` `legal-service` `ai-orchestrator` `document-service` `ml-service` `resort-intelligence` `web` `admin` `mobile` `shared` `ui` `api-client` `infrastructure` `docs` `ci` `deps` `repo`

---

## Testing

- [ ] Unit tests added / updated
- [ ] Integration tests added / updated (if touching service boundaries)
- [ ] Manual testing completed (describe what you tested below)

**Manual test steps:**
1. 
2. 

---

## Security Checklist

- [ ] No secrets or credentials in code
- [ ] All external input validated via DTO / Pydantic model
- [ ] No PII logged (only IDs: userId, caseId)
- [ ] All `Promise` values awaited or explicitly handled
- [ ] Database queries go through Prisma / parameterized (no raw SQL interpolation)

---

## Documentation

- [ ] `docs/` updated if architecture changed
- [ ] ADR created if this was a significant technical decision
- [ ] `.env.example` updated if new environment variables added
- [ ] Service `README.md` updated if API changed

---

## Deployment Notes

<!-- Any special deploy steps? Feature flags needed? Migration required? -->

- [ ] Database migration required
- [ ] Environment variable change required
- [ ] Dependent service must be deployed first: ___________

---

## Screenshots (UI changes only)

<!-- Before / after screenshots or screen recordings -->

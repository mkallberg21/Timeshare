# docs/

This directory contains all project documentation beyond inline code comments.

## Structure

| Path | Contents |
|---|---|
| [`adr/`](adr/) | Architecture Decision Records (MADR format) — the "why" behind every major technical choice |
| [`runbooks/`](runbooks/) | Step-by-step incident response guides for production issues |
| [`diagrams/`](diagrams/) | ERD, data flow, and sequence diagrams (Mermaid source) |
| [`onboarding.md`](onboarding.md) | 30-minute new developer quickstart |
| [`deployment.md`](deployment.md) | How to deploy to staging and production environments |
| [`environment-variables.md`](environment-variables.md) | Complete reference for all environment variables across all services |
| [`coding-standards.md`](coding-standards.md) | TypeScript/Python style guide with examples |

## Philosophy

Documentation lives here instead of in Notion/Confluence so that:
1. It is version-controlled alongside the code it describes
2. It changes in the same PR as the code that makes it outdated
3. Onboarding doesn't require access to external tools

If you are making a significant architectural change, **create or update an ADR** in [`adr/`](adr/) as part of the PR.

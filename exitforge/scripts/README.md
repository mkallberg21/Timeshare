# scripts/

Utility scripts for common developer operations.

## Available Scripts

| Script | Description |
|---|---|
| `setup.sh` | One-shot environment setup: install deps, copy env files, start Docker, run migrations |
| `seed-db.sh` | Seed the development database with test data |
| `create-migration.sh <name>` | Create a new Prisma database migration |

## Usage

```bash
# First-time setup
./scripts/setup.sh

# Seed test data after a fresh database
./scripts/seed-db.sh

# Create a new migration
./scripts/create-migration.sh add_attorney_email_field
```

All scripts are idempotent unless noted otherwise. They should be run from the `exitforge/` directory.

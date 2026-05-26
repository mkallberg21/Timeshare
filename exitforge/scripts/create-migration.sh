#!/usr/bin/env bash
# create-migration.sh — Create a new Prisma migration
# Usage: ./scripts/create-migration.sh <migration_name>
# Example: ./scripts/create-migration.sh add_attorney_email

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <migration_name>"
  echo "Example: $0 add_attorney_email"
  exit 1
fi

MIGRATION_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/services/case-service"

echo "Creating migration: $MIGRATION_NAME"
pnpm prisma migrate dev --name "$MIGRATION_NAME"

echo ""
echo "Migration created in: services/case-service/prisma/migrations/"
echo "Prisma client regenerated."

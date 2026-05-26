#!/usr/bin/env bash
# seed-db.sh — Seed the development database with test data
# Usage: ./scripts/seed-db.sh
# Requires: DATABASE_URL set in services/case-service/.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Seeding ExitForge development database..."

cd "$ROOT_DIR/services/case-service"

if [[ ! -f ".env" ]]; then
  echo "ERROR: services/case-service/.env not found. Run ./scripts/setup.sh first."
  exit 1
fi

# Run Prisma seed
pnpm prisma db seed

echo ""
echo "Database seeded successfully!"
echo ""
echo "Sample data created:"
echo "  - 2 Resort records (Marriott Vacation Club, Wyndham Destinations)"
echo "  - 3 Client records"
echo "  - 3 Case records in various stages"
echo "  - Sample fee calculations"
echo ""
echo "Log in with any seeded user at http://localhost:3000"

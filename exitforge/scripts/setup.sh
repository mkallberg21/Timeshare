#!/usr/bin/env bash
# setup.sh — One-shot developer environment setup
# Usage: ./scripts/setup.sh
# Idempotent: safe to run multiple times

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "ExitForge developer setup"
echo "========================="

# ── Prerequisites check ───────────────────────────────────────────────────────
check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: '$1' is not installed. See docs/onboarding.md for prerequisites."
    exit 1
  fi
}

check_command node
check_command pnpm
check_command python3
check_command docker
check_command docker

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR="${NODE_VERSION%%.*}"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "ERROR: Node.js ≥ 20 required. Found: $NODE_VERSION"
  exit 1
fi

echo "✓ Prerequisites OK"

# ── Node.js dependencies ──────────────────────────────────────────────────────
cd "$ROOT_DIR"
echo "Installing Node.js dependencies..."
pnpm install
echo "✓ Node.js dependencies installed"

# ── Husky hooks ───────────────────────────────────────────────────────────────
echo "Setting up Git hooks..."
pnpm prepare 2>/dev/null || true
chmod +x .husky/pre-commit .husky/commit-msg 2>/dev/null || true
echo "✓ Git hooks configured"

# ── .env files ────────────────────────────────────────────────────────────────
echo "Creating .env files from examples..."
find . -name ".env.example" \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" | while read -r example; do
  target="${example%.example}"
  if [[ ! -f "$target" ]]; then
    cp "$example" "$target"
    echo "  Created: $target"
  else
    echo "  Skipped (exists): $target"
  fi
done
echo "✓ .env files ready"
echo ""
echo "  ACTION REQUIRED: Add your Clerk and Anthropic API keys to each .env file"
echo "  See docs/environment-variables.md for what each variable does"
echo ""

# ── Python virtual environments ───────────────────────────────────────────────
PYTHON_SERVICES=("ai-orchestrator" "document-service" "ml-service" "resort-intelligence")

for service in "${PYTHON_SERVICES[@]}"; do
  service_dir="$ROOT_DIR/services/$service"
  if [[ -f "$service_dir/requirements.txt" ]]; then
    echo "Setting up Python venv for $service..."
    if [[ ! -d "$service_dir/.venv" ]]; then
      python3 -m venv "$service_dir/.venv"
    fi
    "$service_dir/.venv/bin/pip" install --quiet -r "$service_dir/requirements.txt"
    echo "  ✓ $service"
  fi
done

# ── Docker infrastructure ─────────────────────────────────────────────────────
echo "Starting Docker infrastructure..."
docker compose -f "$ROOT_DIR/infrastructure/docker-compose.yml" up -d

echo "Waiting for Postgres to be ready..."
timeout 60 bash -c "until docker exec exitforge-postgres pg_isready -U exitforge; do sleep 2; done"
echo "✓ Postgres ready"

# ── Database migrations ───────────────────────────────────────────────────────
echo "Running Prisma migrations..."
cd "$ROOT_DIR/services/case-service"
if [[ -f ".env" && $(grep -c "DATABASE_URL" .env) -gt 0 ]]; then
  pnpm prisma migrate deploy
  echo "✓ Migrations applied"
else
  echo "  Skipped: DATABASE_URL not set in services/case-service/.env"
fi

cd "$ROOT_DIR"

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add API keys to .env files (see ACTION REQUIRED above)"
echo "  2. pnpm dev           — start all TypeScript services"
echo "  3. Open http://localhost:3000"
echo ""
echo "Full onboarding guide: docs/onboarding.md"

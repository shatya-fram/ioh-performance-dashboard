#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# IOH Performance Dashboard — Local Setup Script
# Runs on macOS and Linux. For Windows, use setup_local.ps1
#
# Usage:
#   chmod +x scripts/setup_local.sh
#   ./scripts/setup_local.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║    IOH Performance Dashboard — Local Setup          ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check prerequisites ────────────────────────────────────────────────────
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ Docker not found. Install from: https://www.docker.com/products/docker-desktop/${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ Docker: $(docker --version)${NC}"

if ! docker info &>/dev/null; then
  echo -e "${RED}❌ Docker daemon is not running. Please start Docker Desktop.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ Docker daemon is running${NC}"

# ── Create .env.local if missing ───────────────────────────────────────────
echo -e "${BLUE}[2/5] Setting up environment...${NC}"

if [ ! -f ".env.local" ]; then
  cp deploy/env.template .env.local
  echo -e "${GREEN}  ✅ Created .env.local from template${NC}"
  echo -e "${YELLOW}  ℹ️  Using default local passwords (safe for development)${NC}"
else
  echo -e "${GREEN}  ✅ .env.local already exists${NC}"
fi

# ── Pull/build images ──────────────────────────────────────────────────────
echo -e "${BLUE}[3/5] Building Docker images (this takes ~2 minutes first time)...${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local build --quiet
echo -e "${GREEN}  ✅ Images built${NC}"

# ── Start services ─────────────────────────────────────────────────────────
echo -e "${BLUE}[4/5] Starting services...${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local up -d
echo -e "${GREEN}  ✅ Services started${NC}"

# ── Wait for MySQL ─────────────────────────────────────────────────────────
echo -e "${BLUE}[5/5] Waiting for MySQL to be ready...${NC}"
MAX_WAIT=60
WAITED=0
while ! docker exec ioh_db_local mysqladmin ping -h localhost -u root -plocalroot123 --silent 2>/dev/null; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}❌ MySQL did not start within ${MAX_WAIT}s${NC}"
    docker logs ioh_db_local --tail 20
    exit 1
  fi
  echo -n "."
  sleep 3
  WAITED=$((WAITED + 3))
done
echo ""
echo -e "${GREEN}  ✅ MySQL is ready${NC}"

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗"
echo "║  🎉 IOH Dashboard is running!                        ║"
echo "║                                                      ║"
echo "║  App:      http://localhost:3000                     ║"
echo "║  Database: localhost:3306 (user: ioh_user)           ║"
echo "║                                                      ║"
echo "║  To stop:  docker compose -f docker-compose.local.yml down"
echo "║  To logs:  docker compose -f docker-compose.local.yml logs -f app"
echo -e "╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Open browser (macOS only)
if command -v open &>/dev/null; then
  sleep 2 && open http://localhost:3000 &
fi

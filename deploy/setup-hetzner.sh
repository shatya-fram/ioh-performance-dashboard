#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# IOH Performance Dashboard — Hetzner Server Setup Script
# Run this on your Hetzner server as root (or sudo user)
# Usage: bash setup-hetzner.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "=== IOH Dashboard — Hetzner Setup ==="

# ─── 1. Update system ────────────────────────────────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -y && apt-get upgrade -y

# ─── 2. Install Docker ───────────────────────────────────────────────────────
echo "[2/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed."
else
  echo "Docker already installed: $(docker --version)"
fi

# ─── 3. Install Docker Compose plugin ───────────────────────────────────────
echo "[3/7] Installing Docker Compose..."
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin
fi
echo "Docker Compose: $(docker compose version)"

# ─── 4. Clone the repository ─────────────────────────────────────────────────
echo "[4/7] Cloning repository..."
APP_DIR="/opt/ioh-dashboard"
if [ -d "$APP_DIR" ]; then
  echo "Directory $APP_DIR already exists. Pulling latest..."
  cd "$APP_DIR" && git pull
else
  git clone https://github.com/shatya-fram/ioh-performance-dashboard.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ─── 5. Set up environment file ──────────────────────────────────────────────
echo "[5/7] Setting up environment..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/deploy/env.template" "$APP_DIR/.env"
  echo ""
  echo "⚠️  IMPORTANT: Edit $APP_DIR/.env with your actual values before continuing!"
  echo "   Required: MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, JWT_SECRET"
  echo "   Optional: VITE_APP_ID, OWNER_OPEN_ID, OWNER_NAME (for Manus OAuth)"
  echo ""
  echo "Run: nano $APP_DIR/.env"
  echo "Then re-run this script or run: cd $APP_DIR && docker compose up -d"
  exit 0
else
  echo ".env already exists, skipping."
fi

# ─── 6. Configure Nginx ──────────────────────────────────────────────────────
echo "[6/7] Nginx config..."
echo "Edit deploy/nginx/conf.d/app.conf and replace YOUR_DOMAIN_OR_IP with your server IP or domain."

# ─── 7. Start services ───────────────────────────────────────────────────────
echo "[7/7] Starting Docker Compose services..."
cd "$APP_DIR"
docker compose pull
docker compose up -d --build

echo ""
echo "=== Setup Complete! ==="
echo "App running at: http://$(curl -s ifconfig.me)"
echo ""
echo "Next steps:"
echo "  1. Run database migrations: docker compose exec app node -e \"require('./dist/index.js')\" (auto-runs on start)"
echo "  2. For HTTPS: edit deploy/nginx/conf.d/app.conf, then run:"
echo "     docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d YOUR_DOMAIN"
echo "  3. Check logs: docker compose logs -f app"
echo ""

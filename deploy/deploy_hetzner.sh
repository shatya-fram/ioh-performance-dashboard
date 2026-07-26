#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# IOH Performance Dashboard — Hetzner Deployment Script
# Deploys the app to dashboard.gamextopia.id on Hetzner server
#
# Run this ON the Hetzner server as root:
#   curl -fsSL https://raw.githubusercontent.com/shatya-fram/ioh-performance-dashboard/main/deploy/deploy_hetzner.sh | bash
#
# Or clone first then run:
#   git clone https://github.com/shatya-fram/ioh-performance-dashboard.git /opt/ioh-dashboard
#   cd /opt/ioh-dashboard && bash deploy/deploy_hetzner.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
DOMAIN="dashboard.gamextopia.id"
APP_DIR="/opt/ioh-dashboard"
GITHUB_REPO="https://github.com/shatya-fram/ioh-performance-dashboard.git"

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║    IOH Dashboard — Hetzner Deployment                ║"
echo "  ║    Target: ${DOMAIN}              ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Install Docker ─────────────────────────────────────────────────────────
echo -e "${BLUE}[1/8] Installing Docker...${NC}"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}  ✅ Docker installed${NC}"
else
  echo -e "${GREEN}  ✅ Docker already installed: $(docker --version)${NC}"
fi

# ── 2. Install Certbot (Let's Encrypt) ───────────────────────────────────────
echo -e "${BLUE}[2/8] Installing Certbot...${NC}"
if ! command -v certbot &>/dev/null; then
  apt-get update -qq
  apt-get install -y certbot python3-certbot-nginx -qq
  echo -e "${GREEN}  ✅ Certbot installed${NC}"
else
  echo -e "${GREEN}  ✅ Certbot already installed${NC}"
fi

# ── 3. Clone or update repository ────────────────────────────────────────────
echo -e "${BLUE}[3/8] Cloning/updating repository...${NC}"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin main
  echo -e "${GREEN}  ✅ Repository updated${NC}"
else
  git clone "$GITHUB_REPO" "$APP_DIR"
  echo -e "${GREEN}  ✅ Repository cloned to $APP_DIR${NC}"
fi
cd "$APP_DIR"

# ── 4. Create .env if missing ─────────────────────────────────────────────────
echo -e "${BLUE}[4/8] Setting up environment...${NC}"
if [ ! -f ".env" ]; then
  cp deploy/env.template .env
  # Generate secure random passwords
  ROOT_PASS=$(openssl rand -hex 16)
  APP_PASS=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)

  sed -i "s/change_me_root_password/$ROOT_PASS/" .env
  sed -i "s/change_me_db_password/$APP_PASS/" .env
  sed -i "s/change_me_jwt_secret_32_chars_min/$JWT_SECRET/" .env
  sed -i "s|mysql://ioh_user:change_me_app_password@db:3306/ioh_dashboard|mysql://ioh_user:${APP_PASS}@db:3306/ioh_dashboard|" .env

  echo -e "${GREEN}  ✅ .env created with secure random passwords${NC}"
  echo -e "${YELLOW}  ⚠️  IMPORTANT: Edit .env to add your Manus OAuth credentials:${NC}"
  echo -e "${YELLOW}     nano $APP_DIR/.env${NC}"
  echo ""
  echo -e "${YELLOW}  Generated passwords (save these!):${NC}"
  echo -e "${YELLOW}    MYSQL_ROOT_PASSWORD: $ROOT_PASS${NC}"
  echo -e "${YELLOW}    MYSQL_PASSWORD:      $APP_PASS${NC}"
  echo -e "${YELLOW}    JWT_SECRET:          $JWT_SECRET${NC}"
  echo ""
else
  echo -e "${GREEN}  ✅ .env already exists${NC}"
fi

# ── 5. Create shared Docker network ──────────────────────────────────────────
echo -e "${BLUE}[5/8] Setting up Docker network...${NC}"
docker network create proxy_network 2>/dev/null || echo "  (network already exists)"
echo -e "${GREEN}  ✅ proxy_network ready${NC}"

# ── 6. Build and start the app ────────────────────────────────────────────────
echo -e "${BLUE}[6/8] Building and starting IOH Dashboard...${NC}"
docker compose up -d --build
echo -e "${GREEN}  ✅ App containers started${NC}"

# Wait for MySQL
echo "  Waiting for MySQL..."
MAX_WAIT=90; WAITED=0
while ! docker exec ioh_db mysqladmin ping -h localhost -u root -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) --silent 2>/dev/null; do
  sleep 3; WAITED=$((WAITED+3))
  [ $WAITED -ge $MAX_WAIT ] && { echo -e "${RED}MySQL timeout${NC}"; exit 1; }
done
echo -e "${GREEN}  ✅ MySQL ready${NC}"

# ── 7. Configure Nginx ────────────────────────────────────────────────────────
echo -e "${BLUE}[7/8] Configuring Nginx reverse proxy...${NC}"

# Install Nginx if not present
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx -qq
fi

# Write Nginx config for the dashboard
cat > /etc/nginx/sites-available/ioh-dashboard << 'NGINX_CONF'
server {
    listen 80;
    server_name dashboard.gamextopia.id;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/ioh-dashboard /etc/nginx/sites-enabled/ioh-dashboard
nginx -t && systemctl reload nginx
echo -e "${GREEN}  ✅ Nginx configured for $DOMAIN${NC}"

# ── 8. SSL Certificate ────────────────────────────────────────────────────────
echo -e "${BLUE}[8/8] Obtaining SSL certificate...${NC}"
echo -e "${YELLOW}  ℹ️  Make sure DNS A record is set: $DOMAIN → $(curl -s ifconfig.me)${NC}"
read -p "  Press Enter when DNS is ready (or Ctrl+C to skip SSL for now)..."

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@gamextopia.id --redirect
echo -e "${GREEN}  ✅ SSL certificate installed${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗"
echo "║  🎉 Deployment Complete!                              ║"
echo "║                                                       ║"
echo "║  URL: https://${DOMAIN}         ║"
echo "║                                                       ║"
echo "║  Useful commands:                                     ║"
echo "║  docker compose logs -f app     (view logs)           ║"
echo "║  docker compose restart app     (restart app)         ║"
echo "║  docker compose down            (stop all)            ║"
echo "║  python3 scripts/health_check.py --url https://${DOMAIN}"
echo -e "╚══════════════════════════════════════════════════════╝${NC}"

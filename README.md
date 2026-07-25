# IOH Performance Dashboard
### Inner Jakarta — Sales & Distribution Analytics

A full-stack performance management dashboard for Indosat Ooredoo Hutchison (IOH) Inner Jakarta, covering dual-brand analytics (IM3 + 3ID), VLR analysis, ANOVA revenue breakdown, SOGA/DMS weekly heatmaps, and kecamatan-level choropleth maps.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite |
| Backend | Node.js + Express + tRPC 11 |
| Database | MySQL 8 (Drizzle ORM) |
| Maps | Leaflet.js + GeoJSON |
| Charts | Recharts + Chart.js |
| Auth | Manus OAuth |

---

## Quick Start — Run Locally with Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/shatya-fram/ioh-performance-dashboard.git
cd ioh-performance-dashboard

# 2. Create environment file (defaults work for local dev)
cp deploy/env.template .env.local

# 3. Build and start all services (app + MySQL)
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build

# 4. Wait ~60 seconds for MySQL to initialize, then open:
open http://localhost:3000
```

The app will be available at **http://localhost:3000**

### Useful local commands

```bash
# View logs
docker compose -f docker-compose.local.yml logs -f app

# Stop all services
docker compose -f docker-compose.local.yml down

# Stop and remove data (fresh start)
docker compose -f docker-compose.local.yml down -v

# Connect to MySQL locally
mysql -h 127.0.0.1 -P 3306 -u ioh_user -plocalpass123 ioh_dashboard
```

---

## Run in Development Mode (without Docker)

### Prerequisites
- Node.js 22+
- pnpm (`npm install -g pnpm`)
- MySQL 8 running locally

```bash
# Install dependencies
pnpm install

# Set environment variables
export DATABASE_URL="mysql://ioh_user:yourpass@localhost:3306/ioh_dashboard"
export JWT_SECRET="your_jwt_secret"

# Push database schema
pnpm db:push

# Start development server (hot reload)
pnpm dev
```

Open **http://localhost:3000**

---

## Production Deployment — Hetzner Server

For deploying to a Hetzner VPS with multiple projects running in parallel, see the full guide:

📄 **[deploy/DEPLOYMENT_GUIDE.md](deploy/DEPLOYMENT_GUIDE.md)**

### Quick production deploy (single server, single project)

```bash
# On your Hetzner server
git clone https://github.com/shatya-fram/ioh-performance-dashboard.git /opt/ioh-dashboard
cd /opt/ioh-dashboard
cp deploy/env.template .env
nano .env   # fill in MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, JWT_SECRET

# Start with production compose (uses shared Nginx proxy)
docker compose up -d --build
```

For domain setup (`dashboard.gamextopia.id`) and SSL, follow the deployment guide.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Session signing key (32+ chars) |
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root password |
| `MYSQL_PASSWORD` | Yes | App DB user password |
| `VITE_APP_ID` | For OAuth | Manus OAuth App ID |
| `OWNER_OPEN_ID` | For OAuth | Manus owner user ID |
| `OWNER_NAME` | For OAuth | Owner display name |

See `deploy/env.template` for the full list.

---

## Project Structure

```
client/src/pages/
  OverallKPI.tsx          ← Overall KPI dashboard
  ANOVAAnalysis.tsx       ← Revenue ANOVA breakdown
  VLRAnalysis.tsx         ← VLR & GAP analysis + maps
  SalesAreaFigures.tsx    ← Sales area performance
  ProductAnalysis.tsx     ← Product analysis
  DataUpload.tsx          ← Data upload interface

client/src/components/
  ChoroplethMap.tsx       ← Leaflet choropleth map
  SogaDmsMap.tsx          ← SOGA/DMS choropleth + heatmap

server/
  routers.ts              ← tRPC API endpoints
  db.ts                   ← Database query helpers

drizzle/
  schema.ts               ← Database schema
```

---

## License

Internal use — Indosat Ooredoo Hutchison Inner Jakarta

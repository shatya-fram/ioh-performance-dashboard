# CLAUDE.md — IOH Performance Dashboard

This file provides full context for AI assistants (Claude, Copilot, etc.) working on this codebase.
Read this before making any changes.

---

## Project Overview

**IOH Performance Dashboard** is an internal analytics platform for **Indosat Ooredoo Hutchison (IOH) Inner Jakarta** — a major Indonesian telecom operator. It is used by the Sales & Distribution team to monitor, analyze, and act on business performance across dual brands and 120+ kecamatan (sub-districts).

**Live URL (Manus):** https://ioh-dashboard-bxcrzret.manus.space
**Target Production URL:** https://dashboard.gamextopia.id (Hetzner server)
**GitHub:** https://github.com/shatya-fram/ioh-performance-dashboard

---

## Business Domain — Telecom Glossary

Understanding these terms is critical before modifying any data logic:

| Term | Definition |
|---|---|
| **IOH** | Indosat Ooredoo Hutchison — the parent company |
| **IM3** | IOH's primary brand (mass market) |
| **3ID** | IOH's secondary brand (youth/data-focused) |
| **Prepaid Revenue** | Sum of Acquisitions Revenue + Base Revenue |
| **IOH Combined Revenue** | Sum of IM3 Revenue + 3ID Revenue |
| **Acquisitions Revenue** | Gross Additions × ARPU Acquisitions |
| **Base Revenue** | Revenue from existing active subscribers |
| **VLR** | Visitor Location Register — count of active SIMs on network |
| **ARPU** | Average Revenue Per User |
| **Pack PU** | Pack Purchase — number of package purchases |
| **RGU 90D** | Revenue Generating Units active in last 90 days |
| **Gross Add** | New subscribers acquired (Gross Additions) |
| **SOGA** | Sales Outlet Gross Addition — distribution metric (%) |
| **DMS** | Distribution Management System metric (%) |
| **MTD** | Month-To-Date (current month running total) |
| **LMTD** | Last Month-To-Date (same period last month) |
| **FM** | Full Month (complete prior month) |
| **YoY** | Year-over-Year comparison |
| **GAP** | MTD minus LMTD (absolute difference) |
| **Kecamatan** | Indonesian administrative sub-district (120 in Inner Jakarta) |
| **ANOVA** | Analysis of Variance — revenue gap decomposition |

### Revenue Formula Hierarchy

```
TOTAL REVENUE
└── PREPAID REVENUE (IOH = IM3 + 3ID)
    ├── ACQUISITIONS REVENUE = Gross Add × ARPU Acquisitions
    └── BASE REVENUE = Active Base × ARPU Base

PREPAID REVENUE = BASE × ARPU
PREPAID REVENUE = TRAFFIC × YIELD
PREPAID REVENUE = NON-VSD DATA + ORGANIC + TRADE + NON-TRADE

REVENUE = Hits (Pack Purchases) × Ticket Size (price per pack)

CHANNELS:
  - Traditional MOBO (Mobile Broadband outlets)
  - Digital Distribution
  - Non Trade
  - Organic
```

### Growth Revenue Formula

```
GROWTH REVENUE = Customer Growth × Value Growth
  Customer Growth = VLR growth + RGU 90D growth
  Value Growth    = ARPU growth + Pack Purchase growth
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| UI Components | shadcn/ui | latest |
| Build Tool | Vite | 7 |
| API Layer | tRPC | 11 |
| Backend | Node.js + Express | 22 / 4 |
| ORM | Drizzle ORM | latest |
| Database | MySQL | 8 |
| Maps | Leaflet.js | latest |
| Charts | Recharts + Chart.js | latest |
| Auth | Manus OAuth | — |
| Package Manager | pnpm | latest |
| Testing | Vitest | latest |
| Containerization | Docker + Docker Compose | — |

---

## Project Structure

```
ioh_performance_dashboard/
│
├── client/                          ← React frontend
│   ├── index.html                   ← Vite entry point (add Google Fonts here)
│   └── src/
│       ├── App.tsx                  ← Routes + DashboardLayout wiring
│       ├── index.css                ← Global CSS variables + Tailwind base
│       ├── main.tsx                 ← React root + providers
│       ├── pages/
│       │   ├── OverallKPI.tsx       ← Overall KPI dashboard (MTD/LMTD/YoY)
│       │   ├── ANOVAAnalysis.tsx    ← Revenue ANOVA decomposition
│       │   ├── VLRAnalysis.tsx      ← VLR & GAP analysis + maps + SOGA/DMS
│       │   ├── SalesAreaFigures.tsx ← Sales area performance table
│       │   ├── ProductAnalysis.tsx  ← Product/pack performance
│       │   ├── DataUpload.tsx       ← Excel file upload interface
│       │   └── Home.tsx             ← Landing/redirect page
│       ├── components/
│       │   ├── ChoroplethMap.tsx    ← Leaflet choropleth (VLR, SOGA, DMS)
│       │   ├── SogaDmsMap.tsx       ← SOGA/DMS map + 5-week heatmap strip
│       │   ├── DashboardLayout.tsx  ← Sidebar navigation shell
│       │   ├── GlobalFilterBar.tsx  ← Brand/Area/Location filter bar
│       │   ├── KpiSelector.tsx      ← KPI metric selector component
│       │   └── ui/                  ← shadcn/ui components (DO NOT modify)
│       ├── contexts/
│       │   └── FilterContext.tsx    ← Global Brand/Area/Location filter state
│       └── lib/
│           ├── trpc.ts              ← tRPC client binding
│           └── kpiUtils.ts          ← KPI calculation helpers
│
├── server/                          ← Node.js backend
│   ├── routers.ts                   ← ALL tRPC procedures (main API file)
│   ├── db.ts                        ← MySQL query helper functions
│   ├── excelParser.ts               ← Excel → structured data parser
│   ├── uploadRouter.ts              ← Multipart file upload handler
│   ├── storage.ts                   ← S3 file storage helpers
│   └── _core/                       ← Framework plumbing (DO NOT modify)
│       ├── index.ts                 ← Express server entry
│       ├── trpc.ts                  ← tRPC context + procedures
│       ├── oauth.ts                 ← Manus OAuth handler
│       └── env.ts                   ← Environment variable validation
│
├── drizzle/                         ← Database
│   ├── schema.ts                    ← Table definitions (source of truth)
│   ├── relations.ts                 ← Drizzle table relations
│   └── 0000_*.sql → 0003_*.sql      ← Migration files (auto-generated)
│
├── shared/                          ← Shared types between client + server
│   ├── types.ts                     ← Shared TypeScript types
│   └── const.ts                     ← Shared constants
│
├── scripts/                         ← Python utility scripts
│   ├── import_data.py               ← Excel → MySQL importer
│   ├── export_db.py                 ← MySQL → SQL/Excel exporter
│   ├── health_check.py              ← App + DB health checker
│   ├── setup_local.sh               ← Mac/Linux one-command setup
│   └── setup_local.ps1              ← Windows one-command setup
│
├── deploy/                          ← Deployment configs
│   ├── database/01_schema.sql       ← Full SQL for fresh DB install
│   ├── env.template                 ← Environment variables template
│   ├── deploy_hetzner.sh            ← Auto-deploy to Hetzner
│   └── nginx/                       ← Nginx reverse proxy config
│
├── Dockerfile                       ← Multi-stage production build
├── docker-compose.yml               ← Hetzner production
├── docker-compose.local.yml         ← Localhost development
├── package.json                     ← Node.js dependencies + scripts
└── drizzle.config.ts                ← Drizzle ORM config
```

---

## Database Schema

### Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `user` | Auth users | `open_id`, `name`, `role` (admin/user) |
| `fm_raw` | Full-month snapshots | `data_date`, `brand`, `area`, `channel`, `revenue`, `vlr`, `gross_add` |
| `mtd_raw` | Month-to-date daily | `data_date`, `brand`, `area`, `channel`, `revenue`, `vlr` |
| `kpi_performance` | KPI MTD/LMTD pairs | `data_date`, `brand`, `revenue_mtd`, `revenue_lmtd`, `vlr_mtd`, `vlr_lmtd` |
| `vlr_kecamatan` | Kecamatan-level VLR | `data_date`, `kecamatan`, `brand`, `vlr_mtd`, `vlr_lmtd`, `vlr_gap`, `latitude`, `longitude` |
| `soga_dms_weekly` | Weekly SOGA/DMS % | `week_label` (W22-W26), `kecamatan`, `brand`, `metric_type` (SOGA/DMS), `value` |
| `product_data` | Product/pack data | `data_date`, `brand`, `product_name`, `hits_mtd`, `revenue_mtd`, `ticket_size` |

### Key Business Rules in Queries

- **IOH Combined** = aggregate of IM3 + 3ID rows (never stored as a single row)
- **GAP** = MTD - LMTD (always computed, never stored)
- **Growth %** = (MTD - LMTD) / LMTD × 100
- **YoY** = current FM vs same month prior year FM (from `mtd_raw` full-month rows)
- **SOGA/DMS IOH Combined** = average of IM3 + 3ID values per kecamatan per week

---

## API Endpoints (tRPC Procedures)

All procedures are in `server/routers.ts`. Key ones:

```typescript
// KPI & Revenue
kpi.getOverall          // MTD/LMTD/FM/YoY for all brands + channels
kpi.getByChannel        // Revenue breakdown by channel (Trade/Non-Trade/Organic/Digital)
kpi.getAnovaBreakdown   // ANOVA decomposition (Base/Acq/Usage/Pack)

// VLR & GAP
vlr.getKecamatanData    // VLR per kecamatan with MTD/LMTD/Gap
vlr.getTenureAnalysis   // VLR by subscriber tenure cohort
vlr.getSubscriberSegments // Subscriber value segmentation

// SOGA & DMS
sogaDms.weekly          // 5-week SOGA/DMS trend per kecamatan + brand

// Product
product.getTopProducts  // Top packs by revenue/hits
product.getByCategory   // Product breakdown by category

// Data Upload
upload.processExcel     // Parse and store uploaded Excel file
upload.getUploadHistory // List of past uploads

// Auth
auth.me                 // Current user
auth.logout             // Logout
```

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (hot reload)
pnpm dev

# Build for production
pnpm build

# Push database schema changes
pnpm db:push

# Run tests
pnpm test

# Type check
npx tsc --noEmit
```

---

## Development Conventions

### Adding a New Feature

1. **Schema first:** Add table to `drizzle/schema.ts`, run `pnpm db:push`
2. **DB helper:** Add query function to `server/db.ts`
3. **tRPC procedure:** Add to `server/routers.ts` using `publicProcedure` or `protectedProcedure`
4. **Frontend:** Create/update page in `client/src/pages/`, call via `trpc.*.useQuery()`
5. **Test:** Add vitest spec in `server/*.test.ts`

### Code Style Rules

- **Never** use `axios` or `fetch` directly — always use `trpc.*.useQuery/useMutation`
- **Never** store IOH Combined as a DB row — always compute it from IM3 + 3ID
- **Always** store timestamps as Unix milliseconds (`bigint`)
- **Always** store monetary values as `decimal(20,2)` in millions IDR
- **Always** store percentages as decimals (0.85 = 85%, not 85)
- **Never** hardcode port numbers in server code
- Use `protectedProcedure` for any endpoint that reads business data
- Use `publicProcedure` only for auth endpoints

### Filter Context

The `FilterContext` provides global `brand`, `area`, and `location` filters. All pages must respect these filters. The filter bar is rendered in `DashboardLayout` and shared across all pages.

```typescript
const { brand, area, location } = useFilters();
// brand: "IOH" | "IM3" | "3ID"
// area: string (e.g. "Jakarta Pusat") or "All Areas"
// location: string or "All Locations"
```

### Chart Colors

Use these consistent brand colors throughout:
```typescript
const BRAND_COLORS = {
  IOH:  "#F97316",  // orange
  IM3:  "#3B82F6",  // blue
  "3ID": "#8B5CF6", // purple
};

const STATUS_COLORS = {
  positive: "#22C55E",  // green
  negative: "#EF4444",  // red
  neutral:  "#94A3B8",  // slate
};
```

---

## Deployment

### Localhost (Docker)
```bash
bash scripts/setup_local.sh        # Mac/Linux
.\scripts\setup_local.ps1          # Windows
# Opens http://localhost:3000
```

### Hetzner Production (dashboard.gamextopia.id)
```bash
# On Hetzner server as root:
bash deploy/deploy_hetzner.sh
```

### Environment Variables
Copy `deploy/env.template` to `.env` and fill in:
- `DATABASE_URL` — MySQL connection string
- `JWT_SECRET` — 32+ char random string
- `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` — DB passwords
- `VITE_APP_ID`, `OWNER_OPEN_ID` — Manus OAuth credentials

---

## Python Data Import Workflow

```bash
# Install Python dependencies
pip install pandas openpyxl pymysql python-dotenv

# Import KPI data
python3 scripts/import_data.py --file data/kpi_july.xlsx --type kpi --date 2026-07-11

# Import VLR kecamatan data
python3 scripts/import_data.py --file data/vlr.xlsx --type vlr --date 2026-07-11

# Import SOGA weekly data (IM3, week W26)
python3 scripts/import_data.py --file data/soga_w26.xlsx --type soga --brand IM3 --week W26 --metric SOGA

# Export database backup
python3 scripts/export_db.py --format sql

# Health check
python3 scripts/health_check.py --url https://dashboard.gamextopia.id
```

---

## Known Constraints & Gotchas

1. **IOH Combined is always computed** — never query for `brand = 'IOH'` directly; instead sum/average IM3 and 3ID rows.
2. **SOGA/DMS values are 0–1 decimals** in the DB (e.g. `0.85` = 85%). The UI multiplies by 100 for display.
3. **VLR numbers are in thousands** — the DB stores raw VLR counts; divide by 1000 for display in K units.
4. **Revenue is in millions IDR** — the DB stores raw values; divide by 1,000,000 for display in Bn IDR.
5. **The `_core/` directory** is framework plumbing — do not modify unless extending infrastructure.
6. **Leaflet maps** require `import 'leaflet/dist/leaflet.css'` and icon fix in the component.
7. **pnpm-lock.yaml** is committed — always use `pnpm` not `npm` or `yarn`.
8. **Manus OAuth** is required for login — the app cannot authenticate without `VITE_APP_ID` and `OWNER_OPEN_ID`.

---

## Contact & Ownership

- **Project Owner:** Inner Jakarta IOH Sales & Distribution Team
- **GitHub:** https://github.com/shatya-fram/ioh-performance-dashboard
- **Production:** https://dashboard.gamextopia.id
- **Manus Preview:** https://ioh-dashboard-bxcrzret.manus.space

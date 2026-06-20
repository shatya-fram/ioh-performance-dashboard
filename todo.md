# IOH Performance Dashboard TODO

## Phase 2: Database Schema & Server
- [x] Database schema: fm_raw, mtd_raw, voucher_game_raw, vlr_tenure_raw, rev_segments_raw, kpi_config, uploads
- [x] Server: Excel parsing endpoint (multer + xlsx)
- [x] Server: tRPC routers for all 5 data domains
- [x] Server: KPI config router
- [x] Server: Geographic hierarchy router (regions/areas/branches/kecamatan)

## Phase 3: Layout, Navigation, Theme, Filters
- [x] Global DashboardLayout with sidebar navigation
- [x] Dark/light elegant theme (deep navy + gold accent)
- [x] Global filter context (Region, Area, Branch, Kecamatan, Brand)
- [x] KPI config-driven selector component
- [x] Filter persistence across all menus

## Phase 4: Overall KPI Performance Dashboard
- [x] Monthly trend line/bar charts (Recharts)
- [x] MTD vs LMTD gap and growth cards
- [x] Monthly Growth, QoQ, YoY growth metrics
- [x] Total and EDB basis analysis
- [x] Brand/Branch/Area/Region filter integration
- [x] KPI selector for this view

## Phase 5: VLR & Customer GAP Analysis
- [x] VLR Tenure Base Analysis chart
- [x] Subscriber Value segmentation (NVC/LVC/MVC/HVC) gap analysis
- [x] Top/Bottom VLR Growth at Kecamatan level
- [x] VLR Missing Kecamatan (MTD vs LMTD)
- [x] Top HVC Growth at Kabupaten level
- [x] Brand/Branch/Kabupaten/Kecamatan filter integration

## Phase 6: ANOVA Revenue Analysis
- [x] Revenue variance waterfall/bridge chart
- [x] Breakdown by Brand, Branch, Revenue Stream, Channel
- [x] Normalized (minus Voucher Game) toggle
- [x] VLR Gap per Branch chart
- [x] Gap Driver Summary (Revenue + Subscriber components)

## Phase 7: Sales Area Figures
- [x] KPI table with month-on-month columns
- [x] MTD, LMTD, GAP, Growth columns
- [x] Trend sparklines per KPI
- [x] Area and Brand selector

## Phase 8: Excel Upload & Data Integration
- [x] Excel file upload UI with drag-and-drop
- [x] Sheet detection and parsing feedback
- [x] Data persistence to database
- [x] Upload history / last updated timestamp

## Phase 9: Polish & Tests
- [x] Responsive layout adjustments
- [x] Loading skeletons and empty states
- [x] Vitest unit tests for server routers (15 tests passing)
- [x] Final checkpoint

## Phase 10: ANOVA Page Redesign
- [x] Replace all charts/waterfall with structured performance table layout
- [x] Revenue rows: Total, Base, Acquisition, Organic, Trade, Non-Trade, Voucher Game
- [x] Columns: MTD, LMTD, Last FM, GAP, Growth %
- [x] 6 summary boxes at top (one per revenue component)
- [x] Brand comparison table (IM3 / 3ID / IOH side by side)
- [x] Voucher Game normalization toggle (subtracts from Total Revenue when ON)
- [x] Dynamic filters: Brand, Area, Branch via GlobalFilterBar
- [x] Period labels in header (MTD month, LMTD month, Last FM month)

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useFilter } from "@/contexts/FilterContext";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import { KpiSelector } from "@/components/KpiSelector";
import {
  KPI_FIELDS,
  formatNumber,
  formatPercent,
  monthLabel,
  calcGrowth,
  calcGap,
  getLMTDMonth,
  getYoYMonths,
  BRAND_COLORS,
  daysElapsedFromMtdDate,
  daysInYearMonth,
  projectFullMonth,
  formatAsOfDate,
} from "@/lib/kpiUtils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── KPI Summary Card ─────────────────────────────────────────────────────────
function KpiCard({
  label,
  mtdValue,
  lmtdValue,
  fmValue,
  yoyValue,
  unit,
  divisor,
}: {
  label: string;
  mtdValue: number;
  lmtdValue: number;
  fmValue: number;
  yoyValue?: number;
  unit: string;
  divisor: number;
}) {
  // MTD vs LMTD: both are same-day snapshots from fm_raw (apples-to-apples)
  const gap = calcGap(mtdValue, lmtdValue);
  const growth = calcGrowth(mtdValue, lmtdValue);
  const isPositive = gap >= 0;
  const yoyGrowth = yoyValue != null && yoyValue !== 0 ? calcGrowth(mtdValue, yoyValue) : null;
  const yoyIsPos = yoyGrowth != null && yoyGrowth >= 0;

  const fmt = (v: number) => {
    const scaled = v / divisor;
    if (Math.abs(scaled) >= 1000) return `${(scaled / 1000).toFixed(2)}K`;
    if (Math.abs(scaled) >= 1) return scaled.toFixed(2);
    return scaled.toFixed(2);
  };

  return (
    <div className="kpi-card fade-in">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground leading-tight max-w-[70%]">
          {label}
        </p>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <div className="mb-2">
        <span className="text-3xl font-bold text-foreground">{fmt(mtdValue)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "value-positive" : "value-negative"}`}>
          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {formatPercent(growth)}
        </span>
        <span className="text-sm text-muted-foreground">vs LMTD</span>
        <span className={`text-sm ml-auto ${isPositive ? "value-positive" : "value-negative"}`}>
          {isPositive ? "+" : ""}{fmt(gap)}
        </span>
      </div>
      <div className="mt-2 pt-2 border-t border-border/50 flex justify-between text-sm text-muted-foreground">
        <span>Last FM: {fmt(fmValue)}</span>
        <span>LMTD: {fmt(lmtdValue)}</span>
      </div>
      {yoyGrowth != null && (
        <div className="mt-1.5 pt-1.5 border-t border-border/30 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">YoY</span>
          <span className={`flex items-center gap-0.5 text-sm font-semibold ${yoyIsPos ? "value-positive" : "value-negative"}`}>
            {yoyIsPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {formatPercent(yoyGrowth)}
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">vs {fmt(yoyValue!)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, fieldName }: any) {
  if (!active || !payload?.length) return null;
  const kpi = KPI_FIELDS[fieldName];
  const divisor = kpi?.divisor ?? 1;
  const unit = kpi?.unit ?? "";
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
      <p className="font-semibold text-foreground mb-2">{monthLabel(label)}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {formatNumber(p.value / divisor, 2)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Custom Label for chart data points ──────────────────────────────────────
function ChartDataLabel({ x, y, value, divisor, width }: any) {
  if (value === undefined || value === null || value === 0) return null;
  const scaled = value / divisor;
  let label: string;
  if (Math.abs(scaled) >= 1000) label = `${(scaled / 1000).toFixed(2)}K`;
  else if (Math.abs(scaled) >= 1) label = scaled.toFixed(2);
  else label = scaled.toFixed(2);

  // For bars, center horizontally; for lines use x directly
  const cx = width !== undefined ? (x ?? 0) + (width ?? 0) / 2 : x;

  return (
    <text
      x={cx}
      y={(y ?? 0) - 8}
      textAnchor="middle"
      fontSize={12}
      fill="oklch(0.90 0.02 250)"
      fontWeight={600}
    >
      {label}
    </text>
  );
}

// ─── Mini KPI Card (fixed 6 KPIs — shows MTD, LMTD and MoM growth) ────────────
function MiniKpiCard({
  label,
  field,
  mtdValue,
  lmtdValue,
  yoyValue,
  divisor,
  unit,
  isActive,
  onClick,
}: {
  label: string;
  field: string;
  mtdValue: number;
  lmtdValue: number;
  yoyValue?: number;
  divisor: number;
  unit: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const growth = calcGrowth(mtdValue, lmtdValue);
  const gap = calcGap(mtdValue, lmtdValue);
  const isPos = gap >= 0;
  const yoyGrowth = yoyValue != null && yoyValue !== 0 ? calcGrowth(mtdValue, yoyValue) : null;
  const yoyIsPos = yoyGrowth != null && yoyGrowth >= 0;

  const fmt = (v: number) => {
    const s = v / divisor;
    if (Math.abs(s) >= 1000) return `${(s / 1000).toFixed(2)}K`;
    if (Math.abs(s) >= 1) return s.toFixed(2);
    return s.toFixed(2);
  };

  return (
    <div
      onClick={onClick}
      className={`kpi-card cursor-pointer transition-all ${isActive ? "ring-1 ring-primary" : "hover:ring-1 hover:ring-border"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground leading-tight max-w-[70%]">{label}</p>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <div className="mb-1">
        <span className="text-2xl font-bold text-foreground">{fmt(mtdValue)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 text-sm font-semibold ${isPos ? "value-positive" : "value-negative"}`}>
          {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {formatPercent(growth)}
        </span>
        <span className="text-sm text-muted-foreground">vs LMTD</span>
        {yoyGrowth != null && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ml-auto ${yoyIsPos ? "value-positive" : "value-negative"}`}>
            {yoyIsPos ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {formatPercent(yoyGrowth)} YoY
          </span>
        )}
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-border/50 flex justify-between text-sm text-muted-foreground">
        <span>MTD: {fmt(mtdValue)}</span>
        <span>LMTD: {fmt(lmtdValue)}</span>
      </div>
    </div>
  );
}

// ─── Growth Table (MoM only, no QoQ/YoY) ─────────────────────────────────────
function GrowthTable({
  fmData,
  mtdData,
  selectedKpis,
}: {
  fmData: Record<string, any>[];  // fm_raw same-day snapshots (for MTD + LMTD)
  mtdData: Record<string, any>[];  // mtd_raw full-month (for Last FM reference only)
  selectedKpis: string[];
}) {
  const [basisMode, setBasisMode] = useState<"total" | "edb">("total");
  // Use fm_raw for MTD and LMTD (same-day snapshots)
  const latestMtdMonth = fmData[fmData.length - 1]?.yearMonth as string | undefined;

  if (!latestMtdMonth) return null;

  const lmtdMonth = getLMTDMonth(latestMtdMonth);

  const getMonthSum = (data: Record<string, any>[], ym: string, field: string) =>
    data.filter((r) => String(r.yearMonth) === ym).reduce((s, r) => s + (Number(r[field]) || 0), 0);

  // EDB = Equal Day Basis: revenue per day
  // Since both MTD and LMTD are same-day snapshots from fm_raw, they cover the same number of days
  // EDB here divides by the day-of-month to get daily rate
  const latestFmEntry = fmData[fmData.length - 1];
  const MTD_DAY = latestFmEntry?._snapshotDay ?? 4; // fallback to 4 if not available
  const getEdbAdjusted = (data: Record<string, any>[], ym: string, field: string) => {
    const total = getMonthSum(data, ym, field);
    return total / MTD_DAY;
  };

  const getValue = basisMode === "edb" ? getEdbAdjusted : getMonthSum;

  const fmtPct = (v: number | null) => {
    if (v === null) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={v >= 0 ? "value-positive" : "value-negative"}>
        {v >= 0 ? "+" : ""}{(v * 100).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="chart-container overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="section-header mb-0">
          <h3 className="text-sm font-semibold text-foreground">Growth Analysis — MoM</h3>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setBasisMode("total")}
            className={`text-sm px-3 py-1 rounded-md transition-all ${
              basisMode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Total Basis
          </button>
          <button
            onClick={() => setBasisMode("edb")}
            className={`text-sm px-3 py-1 rounded-md transition-all ${
              basisMode === "edb" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            EDB Basis
          </button>
        </div>
      </div>
      {basisMode === "edb" && (
        <p className="text-sm text-muted-foreground mb-3 px-1">
          EDB (Equal Day Basis): Prepaid Revenue divided by days elapsed (÷{MTD_DAY}) — normalises for unequal month lengths to give a true daily revenue rate.
        </p>
      )}
      <table className="w-full text-sm data-table">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 rounded-l-md">KPI</th>
            <th className="text-right py-2 px-3">MTD{basisMode === "edb" ? "/day" : ""}</th>
            <th className="text-right py-2 px-3">LMTD{basisMode === "edb" ? "/day" : ""}</th>
            <th className="text-right py-2 px-3">GAP</th>
            <th className="text-right py-2 px-3 rounded-r-md">MoM %</th>
          </tr>
        </thead>
        <tbody>
          {selectedKpis.map((field) => {
            const kpi = KPI_FIELDS[field];
            if (!kpi) return null;
            const mtdVal = getValue(fmData, latestMtdMonth, field);
            const lmtdVal = getValue(fmData, lmtdMonth, field);
            const gap = calcGap(mtdVal, lmtdVal);
            const momGrowth = calcGrowth(mtdVal, lmtdVal);
            const fmtVal = (v: number) => formatNumber(v / kpi.divisor, 2);

            return (
              <tr key={field} className="border-t border-border/30 hover:bg-accent/20 transition-colors">
                <td className="py-2 px-3 font-medium text-foreground">{kpi.label}</td>
                <td className="py-2 px-3 text-right text-foreground">{fmtVal(mtdVal)}</td>
                <td className="py-2 px-3 text-right text-muted-foreground">{fmtVal(lmtdVal)}</td>
                <td className={`py-2 px-3 text-right ${gap >= 0 ? "value-positive" : "value-negative"}`}>
                  {gap >= 0 ? "+" : ""}{fmtVal(gap)}
                </td>
                <td className="py-2 px-3 text-right">{fmtPct(momGrowth)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OverallKPI() {
  const { filter, brandsArray, areasArray, salesAreasArray, kabkotsArray } = useFilter();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [activeKpi, setActiveKpi] = useState("Rev_Prepaid");

  const fmQuery = trpc.fm.trend.useQuery({
    brands: brandsArray,
    areas: areasArray.length ? areasArray : undefined,
    salesAreas: salesAreasArray.length ? salesAreasArray : undefined,
    kabkots: kabkotsArray.length ? kabkotsArray : undefined,
  });

  const mtdQuery = trpc.mtd.trend.useQuery({
    brands: brandsArray,
    areas: areasArray.length ? areasArray : undefined,
    salesAreas: salesAreasArray.length ? salesAreasArray : undefined,
    kabkots: kabkotsArray.length ? kabkotsArray : undefined,
  });

  // ─── FM aggregation by month (all brands combined) ─────────────────────────
  // fm_raw = same-day daily snapshots (Jul 4, Jun 4, May 4...)
  // Used for: MTD (latest month), LMTD (previous month same day), YoY
  // fmByMonth includes ALL months including current partial month
  const fmByMonth = useMemo(() => {
    if (!fmQuery.data) return [];
    const map = new Map<string, Record<string, number>>();
    for (const row of fmQuery.data) {
      const ym = String(row.yearMonth ?? "");
      if (!ym) continue;
      if (!map.has(ym)) {
        const entry: Record<string, any> = { yearMonth: ym };
        for (const f of Object.keys(KPI_FIELDS)) entry[f] = 0;
        map.set(ym, entry);
      }
      const e = map.get(ym)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        const dbField = camelToDb(f);
        e[f] = (e[f] ?? 0) + (Number((row as any)[dbField] ?? (row as any)[f]) || 0);
      }
    }
    return Array.from(map.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [fmQuery.data]);

  // fmByMonthForChart: excludes current partial month (for trend chart only)
  const fmByMonthForChart = useMemo(() => {
    const now = new Date();
    const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    return fmByMonth.filter((r) => String(r.yearMonth) < currentYm);
  }, [fmByMonth]);

  // ─── FM aggregation by month + brand (for multi-line/bar chart) ─────────────
  const fmByMonthBrand = useMemo(() => {
    if (!fmQuery.data) return [];
    const brandMap = new Map<string, Record<string, number>>();
    for (const row of fmQuery.data) {
      const ym = String(row.yearMonth ?? "");
      const brand = String(row.brand ?? "");
      if (!ym || !brand) continue;
      const key = `${ym}__${brand}`;
      if (!brandMap.has(key)) brandMap.set(key, { yearMonth: ym as any, brand: brand as any });
      const e = brandMap.get(key)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        const dbField = camelToDb(f);
        e[f] = (e[f] ?? 0) + (Number((row as any)[dbField] ?? (row as any)[f]) || 0);
      }
    }
    // Pivot to {yearMonth, IM3_Rev_Prepaid, 3ID_Rev_Prepaid, ...}
    const byMonth = new Map<string, Record<string, any>>();
    for (const row of Array.from(brandMap.values())) {
      const ym = String(row.yearMonth);
      const brand = String(row.brand);
      if (!byMonth.has(ym)) byMonth.set(ym, { yearMonth: ym });
      const e = byMonth.get(ym)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        e[`${brand}_${f}`] = (e[`${brand}_${f}`] ?? 0) + (Number(row[f]) || 0);
      }
    }
    const sorted = Array.from(byMonth.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
    // Exclude current partial month from chart
    const now = new Date();
    const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    return sorted.filter((r) => String(r.yearMonth) < currentYm);
  }, [fmQuery.data]);

  // ─── MTD full-month aggregation (mtd_raw = end-of-month totals) ─────────────
  // Used ONLY for: Last FM (previous full month total)
  const mtdByMonth = useMemo(() => {
    if (!mtdQuery.data) return [];
    const mtdMap = new Map<string, Record<string, any>>();
    for (const row of mtdQuery.data) {
      const ym = String(row.yearMonth ?? "");
      if (!ym) continue;
      if (!mtdMap.has(ym)) mtdMap.set(ym, { yearMonth: ym });
      const e = mtdMap.get(ym)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        const dbField = camelToDb(f);
        e[f] = (e[f] ?? 0) + (Number((row as any)[dbField] ?? (row as any)[f]) || 0);
      }
    }
    return Array.from(mtdMap.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [mtdQuery.data]);

  // ─── Key month identifiers ────────────────────────────────────────────────
  // MTD = latest month in fm_raw (same-day snapshot)
  const latestMtdMonth = fmByMonth.length > 0 ? String(fmByMonth[fmByMonth.length - 1]?.yearMonth ?? "") : undefined;
  // LMTD = previous month in fm_raw (same day of previous month)
  const lmtdMonth = latestMtdMonth ? getLMTDMonth(latestMtdMonth) : undefined;
  // YoY = same month last year in fm_raw
  const yoyMonth = latestMtdMonth ? getYoYMonths(latestMtdMonth)[0] : undefined;
  // Last FM = previous full month from mtd_raw
  const latestFmMonth = mtdByMonth.length > 0
    ? String(mtdByMonth.filter(r => String(r.yearMonth) < (latestMtdMonth ?? "999999")).slice(-1)[0]?.yearMonth ?? "")
    : undefined;

  const getMonthData = (data: Record<string, any>[], ym: string | undefined) => {
    if (!ym) return {};
    return data.find((r) => String(r.yearMonth) === ym) ?? {};
  };

  // MTD and LMTD from fm_raw (same-day snapshots — apples-to-apples comparison)
  const mtdLatest = getMonthData(fmByMonth, latestMtdMonth);
  const lmtdData = getMonthData(fmByMonth, lmtdMonth);
  const yoyData = getMonthData(fmByMonth, yoyMonth);
  // Last FM from mtd_raw (full previous month)
  const fmLatest = getMonthData(mtdByMonth, latestFmMonth);

  // Data-as-of label from fm_raw snapshot dates (mtdDate added to getFmTrend)
  const asOfLabel = useMemo(() => {
    if (!latestMtdMonth || !fmQuery.data) return undefined;
    const latestFmRow = fmQuery.data.find(r => String(r.yearMonth) === latestMtdMonth);
    const d = (latestFmRow as any)?.mtdDate;
    return d ? formatAsOfDate(d) : undefined;
  }, [latestMtdMonth, fmQuery.data]);

  const isLoading = fmQuery.isLoading || mtdQuery.isLoading;
  const hasData = fmByMonth.length > 0 || mtdByMonth.length > 0;

  // Chart data: always use fmByMonthBrand (has prefixed keys like IM3_Rev_Trade)
  // For single-brand mode we use the prefixed key ${brand}_${activeKpi} from fmByMonthBrand
  const chartData = fmByMonthBrand.length > 0 ? fmByMonthBrand : fmByMonth;
  const brands = filter.brand === "Combined" ? ["IM3", "3ID"] : [filter.brand];
  // In single-brand mode the dataKey must use the brand prefix (data is stored as IM3_Rev_Trade etc)
  const singleBrandDataKey = filter.brand === "Combined" ? activeKpi : `${filter.brand}_${activeKpi}`;

  // AMENDMENT 3: Fixed 6 KPIs to always show above the main chart
  const FIXED_TOP_KPIS = [
    "Rev_Organic",
    "Rev_Trade",
    "Rev_NonTrade",
    "Rev_Acq_M0",
    "Pack_Purchase_MTD",
    "Subs_RGU90D",
  ];

  // Divisor for chart labels
  const activeDivisor = KPI_FIELDS[activeKpi]?.divisor ?? 1;

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="section-header mb-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">Overall KPI Performance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inner Jakarta · Monthly trend & MTD vs LMTD analysis
              {asOfLabel && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Data as of {asOfLabel}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <KpiSelector />
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as "line" | "bar")}>
            <TabsList className="h-7 bg-secondary">
              <TabsTrigger value="line" className="text-sm h-6 px-3">Line</TabsTrigger>
              <TabsTrigger value="bar" className="text-sm h-6 px-3">Bar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Global filter */}
      <GlobalFilterBar />

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="kpi-card h-28">
              <div className="skeleton h-3 w-24 mb-3" />
              <div className="skeleton h-7 w-16 mb-2" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      {/* No data state */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Data Available</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Upload an Excel file with the required data sheets to see performance metrics.
          </p>
        </div>
      )}

      {!isLoading && hasData && (
        <>
          {/* ROW 1 (now first): Selected KPI Cards with full MTD/LMTD/FM detail */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filter.selectedKpis.map((field) => {
              const kpi = KPI_FIELDS[field];
              if (!kpi) return null;
              return (
                <div
                  key={field}
                  onClick={() => setActiveKpi(field)}
                  className={`cursor-pointer transition-all ${activeKpi === field ? "ring-1 ring-primary rounded-xl" : ""}`}
                >
                  <KpiCard
                    label={kpi.label}
                    mtdValue={Number(mtdLatest[field]) || 0}
                    lmtdValue={Number(lmtdData[field]) || 0}
                    fmValue={Number(fmLatest[field]) || 0}
                    yoyValue={yoyMonth && yoyData[field] ? Number(yoyData[field]) : undefined}
                    unit={kpi.unit}
                    divisor={kpi.divisor}
                  />
                </div>
              );
            })}
          </div>

          {/* ROW 2 (now second): Fixed 6 KPI mini-cards — Organic, Trade, Non-Trade, Acq Rev, Pack Purchase, Subs RGU90D */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {FIXED_TOP_KPIS.map((field) => {
              const kpi = KPI_FIELDS[field];
              if (!kpi) return null;
              return (
                <MiniKpiCard
                  key={field}
                  label={kpi.label}
                  field={field}
                  mtdValue={Number(mtdLatest[field]) || 0}
                  lmtdValue={Number(lmtdData[field]) || 0}
                  yoyValue={yoyMonth && yoyData[field] ? Number(yoyData[field]) : undefined}
                  divisor={kpi.divisor}
                  unit={kpi.unit}
                  isActive={activeKpi === field}
                  onClick={() => setActiveKpi(field)}
                />
              );
            })}
          </div>

          {/* Trend Chart — with data labels on bars/lines */}
          <div className="chart-container">
            <div className="flex items-center justify-between mb-4">
              <div className="section-header mb-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {KPI_FIELDS[activeKpi]?.label ?? activeKpi} — Monthly Trend
                  {filter.brand === "Combined" && (
                    <span className="ml-2 text-sm text-muted-foreground">IM3 + 3ID</span>
                  )}
                </h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[...FIXED_TOP_KPIS, ...filter.selectedKpis.filter((f) => !FIXED_TOP_KPIS.includes(f))].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveKpi(f)}
                    className={`text-sm px-2 py-1 rounded-md transition-all ${
                      activeKpi === f
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {KPI_FIELDS[f]?.label ?? f}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={340}>
              {chartType === "line" ? (
                <LineChart data={chartData} margin={{ top: 24, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis
                    dataKey="yearMonth"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 13, fill: "oklch(0.72 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v / activeDivisor, 0)}
                    tick={{ fontSize: 13, fill: "oklch(0.72 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                    width={68}
                  />
                  <Tooltip content={<CustomTooltip fieldName={activeKpi} />} />
                  <Legend
                    wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }}
                    formatter={(v) => <span style={{ color: "oklch(0.75 0.02 250)" }}>{v}</span>}
                  />
                  {filter.brand === "Combined"
                    ? brands.map((brand) => (
                        <Line
                          key={brand}
                          type="monotone"
                          dataKey={`${brand}_${activeKpi}`}
                          name={brand}
                          stroke={BRAND_COLORS[brand]}
                          strokeWidth={2}
                          dot={{ r: 3, strokeWidth: 0, fill: BRAND_COLORS[brand] }}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        >
                          <LabelList
                            dataKey={`${brand}_${activeKpi}`}
                            position="top"
                            content={(props: any) => (
                              <ChartDataLabel {...props} divisor={activeDivisor} />
                            )}
                          />
                        </Line>
                      ))
                    : (
                        <Line
                          type="monotone"
                          dataKey={singleBrandDataKey}
                          name={filter.brand}
                          stroke={BRAND_COLORS[filter.brand]}
                          strokeWidth={2.5}
                          dot={{ r: 3, strokeWidth: 0, fill: BRAND_COLORS[filter.brand] }}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        >
                          <LabelList
                            dataKey={singleBrandDataKey}
                            position="top"
                            content={(props: any) => (
                              <ChartDataLabel {...props} divisor={activeDivisor} />
                            )}
                          />
                        </Line>
                      )}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 24, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis
                    dataKey="yearMonth"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 13, fill: "oklch(0.72 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v / activeDivisor, 0)}
                    tick={{ fontSize: 13, fill: "oklch(0.72 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                    width={68}
                  />
                  <Tooltip content={<CustomTooltip fieldName={activeKpi} />} />
                  <Legend
                    wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }}
                    formatter={(v) => <span style={{ color: "oklch(0.75 0.02 250)" }}>{v}</span>}
                  />
                  {filter.brand === "Combined"
                    ? brands.map((brand) => (
                        <Bar
                          key={brand}
                          dataKey={`${brand}_${activeKpi}`}
                          name={brand}
                          fill={BRAND_COLORS[brand]}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={32}
                        >
                          <LabelList
                            dataKey={`${brand}_${activeKpi}`}
                            position="top"
                            content={(props: any) => (
                              <ChartDataLabel {...props} divisor={activeDivisor} />
                            )}
                          />
                        </Bar>
                      ))
                    : (
                        <Bar
                          dataKey={singleBrandDataKey}
                          name={filter.brand}
                          fill={BRAND_COLORS[filter.brand]}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={40}
                        >
                          <LabelList
                            dataKey={singleBrandDataKey}
                            position="top"
                            content={(props: any) => (
                              <ChartDataLabel {...props} divisor={activeDivisor} />
                            )}
                          />
                        </Bar>
                      )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Growth Table — MoM only, no QoQ/YoY */}
          <GrowthTable
            fmData={fmByMonth}
            mtdData={mtdByMonth}
            selectedKpis={filter.selectedKpis}
          />
        </>
      )}
    </div>
  );
}

// Helper: convert KPI field key to DB column name
function camelToDb(field: string): string {
  const map: Record<string, string> = {
    Rev_Prepaid: "revPrepaid",
    Rev_Base: "revBase",
    Rev_Acq_M0: "revAcqM0",
    Rev_VSD: "revVsd",
    Rev_NonTrade: "revNonTrade",
    Rev_Trade: "revTrade",
    Rev_Organic: "revOrganic",
    Subs_RGU90D: "subsRgu90d",
    Subs_RGU30D: "subsRgu30d",
    Subs_GrossAdd: "subsGrossAdd",
    Pack_Purchase_MTD: "packPurchaseMtd",
    Subs_Avg_VLR_Daily: "subsAvgVlrDaily",
    M2S: "m2s",
    GA_M2S: "gaM2s",
  };
  return map[field] ?? field;
}

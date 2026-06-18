import { useMemo, useState } from "react";
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
  getQoQMonths,
  getYoYMonths,
  BRAND_COLORS,
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
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── KPI Summary Card ─────────────────────────────────────────────────────────
function KpiCard({
  label,
  mtdValue,
  lmtdValue,
  fmValue,
  unit,
  divisor,
  fieldName,
}: {
  label: string;
  mtdValue: number;
  lmtdValue: number;
  fmValue: number;
  unit: string;
  divisor: number;
  fieldName: string;
}) {
  const gap = calcGap(mtdValue, lmtdValue);
  const growth = calcGrowth(mtdValue, lmtdValue);
  const isPositive = gap >= 0;

  const fmt = (v: number) => {
    const scaled = v / divisor;
    if (Math.abs(scaled) >= 1000) return `${(scaled / 1000).toFixed(1)}K`;
    if (Math.abs(scaled) >= 1) return scaled.toFixed(1);
    return scaled.toFixed(2);
  };

  return (
    <div className="kpi-card fade-in">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight max-w-[70%]">
          {label}
        </p>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>

      {/* MTD Value */}
      <div className="mb-2">
        <span className="text-2xl font-bold text-foreground">{fmt(mtdValue)}</span>
      </div>

      {/* Gap vs LMTD */}
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1 text-xs font-semibold ${
            isPositive ? "value-positive" : "value-negative"
          }`}
        >
          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {formatPercent(growth)}
        </span>
        <span className="text-xs text-muted-foreground">vs LMTD</span>
        <span
          className={`text-xs ml-auto ${isPositive ? "value-positive" : "value-negative"}`}
        >
          {isPositive ? "+" : ""}{fmt(gap)}
        </span>
      </div>

      {/* FM value */}
      <div className="mt-2 pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
        <span>FM: {fmt(fmValue)}</span>
        <span>LMTD: {fmt(lmtdValue)}</span>
      </div>
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
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs">
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

// ─── Growth Table ─────────────────────────────────────────────────────────────
function GrowthTable({
  fmData,
  mtdData,
  selectedKpis,
}: {
  fmData: Record<string, any>[];
  mtdData: Record<string, any>[];
  selectedKpis: string[];
}) {
  const [basisMode, setBasisMode] = useState<"total" | "edb">("total");
  const latestFmMonth = fmData[fmData.length - 1]?.yearMonth as string | undefined;
  const latestMtdMonth = mtdData[mtdData.length - 1]?.yearMonth as string | undefined;

  if (!latestFmMonth || !latestMtdMonth) return null;

  const lmtdMonth = getLMTDMonth(latestMtdMonth);
  const qoqMonth = getQoQMonths(latestMtdMonth)[0];
  const yoyMonth = getYoYMonths(latestMtdMonth)[0];

  const getMonthSum = (data: Record<string, any>[], ym: string, field: string) => {
    return data
      .filter((r) => String(r.yearMonth) === ym)
      .reduce((s, r) => s + (Number(r[field]) || 0), 0);
  };

  // EDB (Existing Data Base) = Base Revenue only (excludes Acquisition)
  // For revenue KPIs, EDB basis subtracts Acquisition Revenue
  const getEdbAdjusted = (data: Record<string, any>[], ym: string, field: string) => {
    const total = getMonthSum(data, ym, field);
    if (field === "Rev_Prepaid") {
      // EDB = Total - Acquisition
      const acq = getMonthSum(data, ym, "Rev_Acq_M0");
      return total - acq;
    }
    return total;
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
          <h3 className="text-sm font-semibold text-foreground">Growth Analysis</h3>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
          <button
            onClick={() => setBasisMode("total")}
            className={`text-xs px-3 py-1 rounded-md transition-all ${
              basisMode === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Total Basis
          </button>
          <button
            onClick={() => setBasisMode("edb")}
            className={`text-xs px-3 py-1 rounded-md transition-all ${
              basisMode === "edb" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            EDB Basis
          </button>
        </div>
      </div>
      {basisMode === "edb" && (
        <p className="text-xs text-muted-foreground mb-3 px-1">
          EDB (Existing Data Base) basis: Revenue KPIs exclude Acquisition Revenue, showing organic base growth only.
        </p>
      )}
      <table className="w-full text-xs data-table">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 rounded-l-md">KPI</th>
            <th className="text-right py-2 px-3">MTD{basisMode === "edb" ? " (EDB)" : ""}</th>
            <th className="text-right py-2 px-3">LMTD{basisMode === "edb" ? " (EDB)" : ""}</th>
            <th className="text-right py-2 px-3">GAP</th>
            <th className="text-right py-2 px-3">MoM %</th>
            <th className="text-right py-2 px-3">QoQ %</th>
            <th className="text-right py-2 px-3 rounded-r-md">YoY %</th>
          </tr>
        </thead>
        <tbody>
          {selectedKpis.map((field) => {
            const kpi = KPI_FIELDS[field];
            if (!kpi) return null;
            const mtdVal = getValue(mtdData, latestMtdMonth, field);
            const lmtdVal = getValue(mtdData, lmtdMonth, field);
            const qoqVal = getValue(fmData, qoqMonth, field);
            const yoyVal = getValue(fmData, yoyMonth, field);
            const gap = calcGap(mtdVal, lmtdVal);
            const momGrowth = calcGrowth(mtdVal, lmtdVal);
            const qoqGrowth = calcGrowth(mtdVal, qoqVal);
            const yoyGrowth = calcGrowth(mtdVal, yoyVal);

            const fmtVal = (v: number) => formatNumber(v / kpi.divisor, 1);

            return (
              <tr key={field} className="border-t border-border/30 hover:bg-accent/20 transition-colors">
                <td className="py-2 px-3 font-medium text-foreground">
                  {kpi.label}
                  {basisMode === "edb" && field === "Rev_Prepaid" && (
                    <span className="ml-1 text-xs text-muted-foreground">(Base only)</span>
                  )}
                </td>
                <td className="py-2 px-3 text-right text-foreground">{fmtVal(mtdVal)}</td>
                <td className="py-2 px-3 text-right text-muted-foreground">{fmtVal(lmtdVal)}</td>
                <td className={`py-2 px-3 text-right ${gap >= 0 ? "value-positive" : "value-negative"}`}>
                  {gap >= 0 ? "+" : ""}{fmtVal(gap)}
                </td>
                <td className="py-2 px-3 text-right">{fmtPct(momGrowth)}</td>
                <td className="py-2 px-3 text-right">{fmtPct(qoqGrowth)}</td>
                <td className="py-2 px-3 text-right">{fmtPct(yoyGrowth)}</td>
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

  // Aggregate FM data by month (combining brands if Combined)
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

  // Aggregate FM data by month and brand (for multi-line)
  const fmByMonthBrand = useMemo(() => {
    if (!fmQuery.data) return [];
    const brandMap = new Map<string, Record<string, number>>();
    for (const row of fmQuery.data) {
      const ym = String(row.yearMonth ?? "");
      const brand = String(row.brand ?? "");
      if (!ym || !brand) continue;
      const key = `${ym}__${brand}`;
      if (!brandMap.has(key)) {
        brandMap.set(key, { yearMonth: ym as any, brand: brand as any });
      }
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
    return Array.from(byMonth.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [fmQuery.data]);

  // MTD aggregated
  const mtdByMonth = useMemo(() => {
    if (!mtdQuery.data) return [];
    const mtdMap = new Map<string, Record<string, any>>();
    for (const row of mtdQuery.data) {
      const ym = String(row.yearMonth ?? "");
      if (!ym) continue;
      if (!mtdMap.has(ym)) {
        mtdMap.set(ym, { yearMonth: ym });
      }
      const e = mtdMap.get(ym)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        const dbField = camelToDb(f);
        e[f] = (e[f] ?? 0) + (Number((row as any)[dbField] ?? (row as any)[f]) || 0);
      }
    }
    return Array.from(mtdMap.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [mtdQuery.data]);

  const latestMtdMonth = mtdByMonth.length > 0 ? String(mtdByMonth[mtdByMonth.length - 1]?.yearMonth ?? "") : undefined;
  const lmtdMonth = latestMtdMonth ? getLMTDMonth(latestMtdMonth) : undefined;
  const latestFmMonth = fmByMonth.length > 0 ? String(fmByMonth[fmByMonth.length - 1]?.yearMonth ?? "") : undefined;

  const getMonthData = (data: Record<string, any>[], ym: string | undefined) => {
    if (!ym) return {};
    return data.find((r) => String(r.yearMonth) === ym) ?? {};
  };

  const mtdLatest = getMonthData(mtdByMonth, latestMtdMonth);
  const lmtdData = getMonthData(mtdByMonth, lmtdMonth);
  const fmLatest = getMonthData(fmByMonth, latestFmMonth);

  const isLoading = fmQuery.isLoading || mtdQuery.isLoading;
  const hasData = fmByMonth.length > 0 || mtdByMonth.length > 0;

  // Chart data: use FM for trend, MTD for current period
  const chartData = fmByMonthBrand.length > 0 ? fmByMonthBrand : fmByMonth;
  const brands = filter.brand === "Combined" ? ["IM3", "3ID"] : [filter.brand];

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="section-header mb-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">Overall KPI Performance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inner Jakarta · Monthly trend & MTD vs LMTD analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <KpiSelector />
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as "line" | "bar")}>
            <TabsList className="h-7 bg-secondary">
              <TabsTrigger value="line" className="text-xs h-6 px-3">Line</TabsTrigger>
              <TabsTrigger value="bar" className="text-xs h-6 px-3">Bar</TabsTrigger>
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

      {/* KPI Cards */}
      {!isLoading && hasData && (
        <>
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
                    unit={kpi.unit}
                    divisor={kpi.divisor}
                    fieldName={field}
                  />
                </div>
              );
            })}
          </div>

          {/* Trend Chart */}
          <div className="chart-container">
            <div className="flex items-center justify-between mb-4">
              <div className="section-header mb-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {KPI_FIELDS[activeKpi]?.label ?? activeKpi} — Monthly Trend
                </h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {filter.selectedKpis.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveKpi(f)}
                    className={`text-xs px-2 py-1 rounded-md transition-all ${
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

            <ResponsiveContainer width="100%" height={320}>
              {chartType === "line" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis
                    dataKey="yearMonth"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v / (KPI_FIELDS[activeKpi]?.divisor ?? 1), 0)}
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip fieldName={activeKpi} />} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
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
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                      ))
                    : (
                        <Line
                          type="monotone"
                          dataKey={activeKpi}
                          name={filter.brand}
                          stroke={BRAND_COLORS[filter.brand]}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                      )}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis
                    dataKey="yearMonth"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v / (KPI_FIELDS[activeKpi]?.divisor ?? 1), 0)}
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip fieldName={activeKpi} />} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
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
                        />
                      ))
                    : (
                        <Bar
                          dataKey={activeKpi}
                          name={filter.brand}
                          fill={BRAND_COLORS[filter.brand]}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={40}
                        />
                      )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Growth Table */}
          <GrowthTable
            fmData={fmByMonth}
            mtdData={mtdByMonth}
            selectedKpis={filter.selectedKpis}
          />

          {/* MTD vs LMTD Gap Chart */}
          <div className="chart-container">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">MTD vs LMTD Gap — All KPIs</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={filter.selectedKpis.map((field) => {
                  const kpi = KPI_FIELDS[field];
                  if (!kpi) return null;
                  const mtdVal = Number(mtdLatest[field]) || 0;
                  const lmtdVal = Number(lmtdData[field]) || 0;
                  const gap = calcGap(mtdVal, lmtdVal);
                  const growth = calcGrowth(mtdVal, lmtdVal);
                  return {
                    name: kpi.label,
                    MTD: mtdVal / kpi.divisor,
                    LMTD: lmtdVal / kpi.divisor,
                    gap: gap / kpi.divisor,
                    growth: growth !== null ? growth * 100 : 0,
                  };
                }).filter(Boolean)}
                margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }}
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.14 0.022 250)",
                    border: "1px solid oklch(0.25 0.03 250)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <ReferenceLine y={0} stroke="oklch(0.40 0.04 250)" />
                <Bar dataKey="MTD" name="MTD" fill="oklch(0.78 0.16 75)" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="LMTD" name="LMTD" fill="oklch(0.40 0.04 250)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// Helper: convert camelCase field to db column name
function camelToDb(field: string): string {
  // Map KPI_FIELDS keys to DB column names (camelCase from drizzle)
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

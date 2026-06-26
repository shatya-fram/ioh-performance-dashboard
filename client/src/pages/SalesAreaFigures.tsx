import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useFilter } from "@/contexts/FilterContext";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import { KpiSelector } from "@/components/KpiSelector";
import {
  KPI_FIELDS,
  formatNumber,
  monthLabel,
  calcGrowth,
  calcGap,
  getLMTDMonth,
  BRAND_COLORS,
} from "@/lib/kpiUtils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MapPin, TrendingUp, TrendingDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-sm">—</span>;
  const pct = value * 100;
  return (
    <span className={`flex items-center gap-0.5 text-sm font-semibold ${pct >= 0 ? "value-positive" : "value-negative"}`}>
      {pct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export default function SalesAreaFigures() {
  const { filter, brandsArray, areasArray, salesAreasArray, kabkotsArray } = useFilter();
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

  // ─── Aggregate FM by month and brand ─────────────────────────────────────
  const fmByMonthBrand = useMemo(() => {
    if (!fmQuery.data) return [];
    const map = new Map<string, Record<string, any>>();
    for (const row of fmQuery.data) {
      const ym = String(row.yearMonth ?? "");
      const brand = String(row.brand ?? "");
      if (!ym) continue;
      const key = `${ym}__${brand}`;
      if (!map.has(key)) map.set(key, { yearMonth: ym, brand });
      const e = map.get(key)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        const dbField = camelToDb(f);
        e[f] = (e[f] ?? 0) + (Number((row as any)[dbField] ?? (row as any)[f]) || 0);
      }
    }
    // Pivot to {yearMonth, IM3_Rev_Prepaid, 3ID_Rev_Prepaid, ...}
    const byMonth = new Map<string, Record<string, any>>();
    for (const row of Array.from(map.values())) {
      const ym = String(row.yearMonth);
      const brand = String(row.brand);
      if (!byMonth.has(ym)) byMonth.set(ym, { yearMonth: ym });
      const e = byMonth.get(ym)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        e[`${brand}_${f}`] = (e[`${brand}_${f}`] ?? 0) + (Number(row[f]) || 0);
        // Combined
        e[f] = (e[f] ?? 0) + (Number(row[f]) || 0);
      }
    }
    return Array.from(byMonth.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [fmQuery.data]);

  // ─── MTD aggregated ───────────────────────────────────────────────────────
  const mtdByMonth = useMemo(() => {
    if (!mtdQuery.data) return [];
    const map = new Map<string, Record<string, any>>();
    for (const row of mtdQuery.data) {
      const ym = String(row.yearMonth ?? "");
      const brand = String(row.brand ?? "");
      if (!ym) continue;
      const key = `${ym}__${brand}`;
      if (!map.has(key)) map.set(key, { yearMonth: ym, brand });
      const e = map.get(key)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        const dbField = camelToDb(f);
        e[f] = (e[f] ?? 0) + (Number((row as any)[dbField] ?? (row as any)[f]) || 0);
      }
    }
    // Pivot
    const byMonth = new Map<string, Record<string, any>>();
    for (const row of Array.from(map.values())) {
      const ym = String(row.yearMonth);
      const brand = String(row.brand);
      if (!byMonth.has(ym)) byMonth.set(ym, { yearMonth: ym });
      const e = byMonth.get(ym)!;
      for (const f of Object.keys(KPI_FIELDS)) {
        e[`${brand}_${f}`] = (e[`${brand}_${f}`] ?? 0) + (Number(row[f]) || 0);
        e[f] = (e[f] ?? 0) + (Number(row[f]) || 0);
      }
    }
    return Array.from(byMonth.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [mtdQuery.data]);

  const months = useMemo(() => fmByMonthBrand.map((r) => String(r.yearMonth)), [fmByMonthBrand]);
  const latestMtdMonth = mtdByMonth.length > 0 ? String(mtdByMonth[mtdByMonth.length - 1]?.yearMonth ?? "") : undefined;
  const lmtdMonth = latestMtdMonth ? getLMTDMonth(latestMtdMonth) : undefined;

  const getMtdRow = (ym: string | undefined) => {
    if (!ym) return {};
    return mtdByMonth.find((r) => String(r.yearMonth) === ym) ?? {};
  };

  const mtdLatest = getMtdRow(latestMtdMonth);
  const lmtdData = getMtdRow(lmtdMonth);

  const brands = filter.brand === "Combined" ? ["IM3", "3ID"] : [filter.brand];
  const isLoading = fmQuery.isLoading || mtdQuery.isLoading;

  // Summary area info
  const areaLabel = filter.area || filter.branch || "Inner Jakarta";
  const brandLabel = filter.brand;

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="section-header mb-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">Sales Area Figures</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {areaLabel} · {brandLabel} · All KPI performance
              </span>
            </p>
          </div>
        </div>
        <KpiSelector />
      </div>

      <GlobalFilterBar />

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <div className="chart-container h-64"><div className="skeleton h-full w-full" /></div>
          <div className="chart-container h-40"><div className="skeleton h-full w-full" /></div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Trend Chart */}
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
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={fmByMonthBrand} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.14 0.022 250)",
                    border: "1px solid oklch(0.25 0.03 250)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(v: any) => [
                    `${formatNumber(v / (KPI_FIELDS[activeKpi]?.divisor ?? 1), 2)} ${KPI_FIELDS[activeKpi]?.unit ?? ""}`,
                  ]}
                  labelFormatter={monthLabel}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
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
            </ResponsiveContainer>
          </div>

          {/* KPI Performance Table */}
          <div className="chart-container overflow-x-auto">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                KPI Performance Table — {areaLabel} · {brandLabel}
              </h3>
            </div>
            <table className="w-full text-sm data-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 rounded-l-md sticky left-0 bg-card z-10">KPI</th>
                  {months.slice(-12).map((ym) => (
                    <th key={ym} className="text-right py-2 px-2 whitespace-nowrap">
                      {monthLabel(ym)}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 bg-primary/10 text-primary whitespace-nowrap">MTD</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">LMTD</th>
                  <th className="text-right py-2 px-3 whitespace-nowrap">GAP</th>
                  <th className="text-right py-2 px-3 rounded-r-md whitespace-nowrap">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {filter.selectedKpis.map((field) => {
                  const kpi = KPI_FIELDS[field];
                  if (!kpi) return null;

                  const getVal = (row: Record<string, any>, f: string) => {
                    if (filter.brand === "Combined") return Number(row[f] ?? 0);
                    return Number(row[`${filter.brand}_${f}`] ?? row[f] ?? 0);
                  };

                  const mtdVal = getVal(mtdLatest, field);
                  const lmtdVal = getVal(lmtdData, field);
                  const gap = calcGap(mtdVal, lmtdVal);
                  const growth = calcGrowth(mtdVal, lmtdVal);

                  const fmt = (v: number) => formatNumber(v / kpi.divisor, 1);

                  return (
                    <tr
                      key={field}
                      className="border-t border-border/30 hover:bg-accent/20 transition-colors cursor-pointer"
                      onClick={() => setActiveKpi(field)}
                    >
                      <td className={`py-2 px-3 font-medium sticky left-0 bg-card z-10 ${activeKpi === field ? "text-primary" : "text-foreground"}`}>
                        {kpi.label}
                        <span className="text-muted-foreground ml-1 text-sm">({kpi.unit})</span>
                      </td>
                      {months.slice(-12).map((ym) => {
                        const fmRow = fmByMonthBrand.find((r) => String(r.yearMonth) === ym) ?? {};
                        const v = getVal(fmRow, field);
                        return (
                          <td key={ym} className="py-2 px-2 text-right text-foreground/80 whitespace-nowrap">
                            {fmt(v)}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-semibold text-primary whitespace-nowrap">{fmt(mtdVal)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground whitespace-nowrap">{fmt(lmtdVal)}</td>
                      <td className={`py-2 px-3 text-right font-semibold whitespace-nowrap ${gap >= 0 ? "value-positive" : "value-negative"}`}>
                        {gap >= 0 ? "+" : ""}{fmt(gap)}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <GrowthBadge value={growth} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Brand comparison table */}
          {filter.brand === "Combined" && (
            <div className="chart-container overflow-x-auto">
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground">Brand Comparison — MTD vs LMTD</h3>
              </div>
              <table className="w-full text-sm data-table">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 rounded-l-md">KPI</th>
                    {brands.map((b) => (
                      <React.Fragment key={b}>
                        <th className="text-right py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-sm ${b === "IM3" ? "badge-im3" : "badge-3id"}`}>{b}</span> MTD
                        </th>
                        <th className="text-right py-2 px-2 text-muted-foreground">{b} LMTD</th>
                        <th className="text-right py-2 px-2">{b} GAP%</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filter.selectedKpis.map((field) => {
                    const kpi = KPI_FIELDS[field];
                    if (!kpi) return null;
                    const fmt = (v: number) => formatNumber(v / kpi.divisor, 1);
                    return (
                      <tr key={field} className="border-t border-border/30 hover:bg-accent/20">
                        <td className="py-2 px-3 font-medium text-foreground">{kpi.label}</td>
                        {brands.map((brand) => {
                          const mtdVal = Number(mtdLatest[`${brand}_${field}`] ?? 0);
                          const lmtdVal = Number(lmtdData[`${brand}_${field}`] ?? 0);
                          const growth = calcGrowth(mtdVal, lmtdVal);
                          return (
                            <React.Fragment key={brand}>
                              <td className="py-2 px-2 text-right text-foreground">{fmt(mtdVal)}</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">{fmt(lmtdVal)}</td>
                              <td className="py-2 px-2 text-right">
                                <GrowthBadge value={growth} />
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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

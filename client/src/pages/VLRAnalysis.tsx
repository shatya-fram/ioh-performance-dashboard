import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useFilter } from "@/contexts/FilterContext";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import {
  monthLabel,
  TENURE_COLORS,
  SEGMENT_COLORS,
  BRAND_COLORS,
  formatNumber,
  calcGrowth,
} from "@/lib/kpiUtils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, TrendingUp, TrendingDown, Users, Map as MapIcon } from "lucide-react";
import ChoroplethMap from "@/components/ChoroplethMap";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TENURE_GROUPS = [
  "1. 0-1M", "2. 1-2M", "3. 2-3M", "4a. 3-4M",
  "4b. 4-6M", "5. 6M-1Y", "6. 1Y-2Y", "7. >2Y",
];

const SEGMENTS = ["01. NVC", "02. LVC", "03. MVC", "04. HVC"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-2">{monthLabel(String(label))}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{formatNumber(p.value, 1)}K</span>
        </div>
      ))}
    </div>
  );
}

export default function VLRAnalysis() {
  const { filter, brandsArray, areasArray, kabkotsArray } = useFilter();
  const [activeTab, setActiveTab] = useState<"tenure" | "segments" | "ranking" | "map">("tenure");
  const [mapMetric, setMapMetric] = useState<"vlr" | "growth" | "gap">("vlr");
  const [selectedBrandVlr, setSelectedBrandVlr] = useState<string>("IM3");
  const [topN, setTopN] = useState(15);

  // VLR Tenure data
  const vlrQuery = trpc.vlr.trend.useQuery({
    brands: [selectedBrandVlr],
    areas: areasArray.length ? areasArray : undefined,
    kabkots: kabkotsArray.length ? kabkotsArray : undefined,
  });

  // Kec Rank data
  const kecRankQuery = trpc.vlr.kecRank.useQuery({
    kabkots: kabkotsArray.length ? kabkotsArray : undefined,
  });

  // Rev Segments data
  const segmentsQuery = trpc.segments.trend.useQuery({
    brands: brandsArray,
    areas: areasArray.length ? areasArray : undefined,
    kabkots: kabkotsArray.length ? kabkotsArray : undefined,
  });

  // ─── VLR Tenure trend by month ────────────────────────────────────────────
  const vlrTrendData = useMemo(() => {
    if (!vlrQuery.data) return [];
    // VLR data hierarchy: kecamatan-level rows have kecamatanNm set
    // kabkot-level summary rows have kabkotNm='Total' and kecamatanNm=null
    // area-level summary rows have kabkotNm=null and kecamatanNm=null
    // Use area-level rows (kabkotNm=null, kecamatanNm=null) for overall trend
    // If no area-level rows, fall back to kabkot=Total rows (summed across kabkots)
    let totalRows = vlrQuery.data.filter(
      (r) => !r.kecamatanNm && !r.kabkotNm
    );
    if (totalRows.length === 0) {
      // Fall back: use kabkotNm='Total' rows and sum across kabkots
      totalRows = vlrQuery.data.filter(
        (r) => r.kabkotNm === 'Total' && !r.kecamatanNm
      );
    }
    const map = new Map<string, Record<string, any>>();
    for (const row of totalRows) {
      const ym = String(row.yearMonth ?? "");
      if (!ym) continue;
      if (!map.has(ym)) map.set(ym, { yearMonth: ym });
      const e = map.get(ym)!;
      const tg = String(row.tenureGroup ?? "");
      if (TENURE_GROUPS.includes(tg)) {
        e[tg] = (e[tg] ?? 0) + (Number(row.vlrDlyFm) || 0) / 1000;
      }
    }
    return Array.from(map.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [vlrQuery.data]);

  // ─── Subscriber Segments trend ────────────────────────────────────────────
  const segTrendData = useMemo(() => {
    if (!segmentsQuery.data) return [];
    const map = new Map<string, Record<string, any>>();
    for (const row of segmentsQuery.data) {
      const ym = String(row.monthMtd ?? "");
      if (!ym) continue;
      if (!map.has(ym)) map.set(ym, { yearMonth: ym });
      const e = map.get(ym)!;
      const seg = String(row.valueSegment ?? "");
      if (SEGMENTS.includes(seg)) {
        e[seg] = (e[seg] ?? 0) + (Number(row.subscriber) || 0) / 1000;
      }
    }
    return Array.from(map.values()).sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)));
  }, [segmentsQuery.data]);

  // ─── Segment gap by kabkot ────────────────────────────────────────────────
  const segGapByKabkot = useMemo(() => {
    if (!segmentsQuery.data) return [];
    const months = Array.from(new Set(segmentsQuery.data.map((r) => String(r.monthMtd ?? "")))).sort();
    const latestMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];
    if (!latestMonth || !prevMonth) return [];

    const kabkotMap = new Map<string, { kabkot: string; brand: string; current: number; previous: number }>();
    for (const row of segmentsQuery.data) {
      const ym = String(row.monthMtd ?? "");
      const kabkot = String(row.kabkotNm ?? "");
      const brand = String(row.brand ?? "");
      const seg = String(row.valueSegment ?? "");
      if (!kabkot || !brand) continue;
      const key = `${kabkot}__${brand}`;
      if (!kabkotMap.has(key)) kabkotMap.set(key, { kabkot, brand, current: 0, previous: 0 });
      const e = kabkotMap.get(key)!;
      if (ym === latestMonth) e.current += Number(row.subscriber) || 0;
      if (ym === prevMonth) e.previous += Number(row.subscriber) || 0;
    }
    return Array.from(kabkotMap.values())
      .map((r) => ({
        ...r,
        gap: r.current - r.previous,
        growth: calcGrowth(r.current, r.previous),
      }))
      .sort((a, b) => a.gap - b.gap);
  }, [segmentsQuery.data]);

  // ─── Kec Rank: Top/Bottom VLR ─────────────────────────────────────────────
  const kecTopBottom = useMemo(() => {
    if (!kecRankQuery.data) return { top: [], bottom: [], topHvc: [] };
    const brand = selectedBrandVlr === "IM3" ? "im3" : "threeid";
    const sorted = [...kecRankQuery.data].sort((a, b) => {
      const aGap = Number((a as any)[`${brand}Gap`] ?? 0);
      const bGap = Number((b as any)[`${brand}Gap`] ?? 0);
      return bGap - aGap;
    });
    const top = sorted.slice(0, topN);
    const bottom = sorted.slice(-topN).reverse();

    const hvcSorted = [...kecRankQuery.data].sort((a, b) => {
      const aGap = Number((a as any)[`${brand}HvcGap`] ?? 0);
      const bGap = Number((b as any)[`${brand}HvcGap`] ?? 0);
      return bGap - aGap;
    });
    const topHvc = hvcSorted.slice(0, topN);

    return { top, bottom, topHvc };
  }, [kecRankQuery.data, selectedBrandVlr, topN]);

  // ─── Choropleth map data: kecamatan-level VLR from kecRank ─────────────────
  const mapData = useMemo(() => {
    if (!kecRankQuery.data) return [];
    const brand = selectedBrandVlr === "IM3" ? "im3" : "threeid";
    return kecRankQuery.data
      .filter((r) => r.kecamatan && r.kecamatan !== "Total")
      .map((r) => {
        const rec = r as any;
        const mtd = Number(rec[`${brand}Mtd`] ?? 0);
        const lmtd = Number(rec[`${brand}Lmtd`] ?? 0);
        const gap = Number(rec[`${brand}Gap`] ?? 0);
        const growth = lmtd > 0 ? ((mtd - lmtd) / lmtd) * 100 : null;
        // VLR rate: compute as MTD/LMTD ratio × 100 for relative performance
        const vlrValue = lmtd > 0 ? (mtd / lmtd) * 100 : null;
        return {
          kecamatan: String(r.kecamatan ?? "").toUpperCase(),
          kabupaten: String(rec.kabkot ?? "").toUpperCase(),
          value: mapMetric === "vlr" ? vlrValue : mapMetric === "gap" ? gap : growth,
          valueMtd: mtd,
          valueLmtd: lmtd,
          growth: growth,
        };
      });
  }, [kecRankQuery.data, selectedBrandVlr, mapMetric]);

  const isLoading = vlrQuery.isLoading || segmentsQuery.isLoading || kecRankQuery.isLoading;

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="section-header mb-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">VLR & Customer GAP Analysis</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tenure base analysis · Subscriber value segmentation · Kecamatan ranking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedBrandVlr} onValueChange={setSelectedBrandVlr}>
            <SelectTrigger className="h-7 w-24 text-xs bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IM3">IM3</SelectItem>
              <SelectItem value="3ID">3ID</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <GlobalFilterBar />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="tenure" className="text-xs">VLR Tenure Analysis</TabsTrigger>
          <TabsTrigger value="segments" className="text-xs">Subscriber Segments</TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs">Kecamatan Ranking</TabsTrigger>
          <TabsTrigger value="map" className="text-xs flex items-center gap-1"><MapIcon size={12} />Hotspot Map</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4">
          <div className="chart-container h-80">
            <div className="skeleton h-full w-full" />
          </div>
        </div>
      )}

      {/* ─── VLR Tenure Analysis ─────────────────────────────────────────── */}
      {!isLoading && activeTab === "tenure" && (
        <div className="space-y-6">
          {/* Stacked Area Chart */}
          <div className="chart-container">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                VLR Daily Average by Tenure Group — {selectedBrandVlr}
              </h3>
            </div>
            {vlrTrendData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Wifi className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No VLR data available</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={vlrTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    {TENURE_GROUPS.map((tg) => (
                      <linearGradient key={tg} id={`grad-${tg.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={TENURE_COLORS[tg]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={TENURE_COLORS[tg]} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis
                    dataKey="yearMonth"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    tickFormatter={(v) => `${v.toFixed(0)}K`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "12px" }} />
                  {TENURE_GROUPS.map((tg) => (
                    <Area
                      key={tg}
                      type="monotone"
                      dataKey={tg}
                      name={tg}
                      stroke={TENURE_COLORS[tg]}
                      fill={`url(#grad-${tg.replace(/[^a-z0-9]/gi, "")})`}
                      strokeWidth={1.5}
                      dot={false}
                      stackId="1"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Latest month breakdown bar */}
          <div className="chart-container">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">Latest Month VLR by Tenure — {selectedBrandVlr}</h3>
            </div>
            {vlrTrendData.length > 0 && (() => {
              const latest = vlrTrendData[vlrTrendData.length - 1];
              const prev = vlrTrendData[vlrTrendData.length - 2];
              const barData = TENURE_GROUPS.map((tg) => ({
                name: tg,
                MTD: Number(latest?.[tg] ?? 0),
                LMTD: Number(prev?.[tg] ?? 0),
                gap: Number(latest?.[tg] ?? 0) - Number(prev?.[tg] ?? 0),
              }));
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v.toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <ReferenceLine y={0} stroke="oklch(0.40 0.04 250)" />
                    <Bar dataKey="MTD" name="MTD" radius={[3, 3, 0, 0]} maxBarSize={30}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={TENURE_COLORS[entry.name] ?? "#888"} />
                      ))}
                    </Bar>
                    <Bar dataKey="LMTD" name="LMTD" fill="oklch(0.35 0.03 250)" radius={[3, 3, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Subscriber Segments ─────────────────────────────────────────── */}
      {!isLoading && activeTab === "segments" && (
        <div className="space-y-6">
          {/* Segment trend */}
          <div className="chart-container">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">Subscriber Value Segments — Monthly Trend</h3>
            </div>
            {segTrendData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No segment data available</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={segTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    {SEGMENTS.map((seg) => (
                      <linearGradient key={seg} id={`seg-${seg.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SEGMENT_COLORS[seg]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={SEGMENT_COLORS[seg]} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis dataKey="yearMonth" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v.toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "12px" }} />
                  {SEGMENTS.map((seg) => (
                    <Area key={seg} type="monotone" dataKey={seg} name={seg} stroke={SEGMENT_COLORS[seg]} fill={`url(#seg-${seg.replace(/[^a-z0-9]/gi, "")})`} strokeWidth={2} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Segment gap by kabkot */}
          <div className="chart-container overflow-x-auto">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">Subscriber Gap by Kabupaten (MTD vs LMTD)</h3>
            </div>
            {segGapByKabkot.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <table className="w-full text-xs data-table">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 rounded-l-md">Kabupaten</th>
                    <th className="text-left py-2 px-3">Brand</th>
                    <th className="text-right py-2 px-3">MTD</th>
                    <th className="text-right py-2 px-3">LMTD</th>
                    <th className="text-right py-2 px-3">GAP</th>
                    <th className="text-right py-2 px-3 rounded-r-md">Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {segGapByKabkot.map((r, i) => (
                    <tr key={i} className="border-t border-border/30 hover:bg-accent/20 transition-colors">
                      <td className="py-2 px-3 font-medium text-foreground">{r.kabkot}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.brand === "IM3" ? "badge-im3" : "badge-3id"}`}>
                          {r.brand}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">{formatNumber(r.current / 1000, 1)}K</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(r.previous / 1000, 1)}K</td>
                      <td className={`py-2 px-3 text-right font-semibold ${r.gap >= 0 ? "value-positive" : "value-negative"}`}>
                        {r.gap >= 0 ? "+" : ""}{formatNumber(r.gap / 1000, 1)}K
                      </td>
                      <td className={`py-2 px-3 text-right ${(r.growth ?? 0) >= 0 ? "value-positive" : "value-negative"}`}>
                        {r.growth !== null ? `${r.growth >= 0 ? "+" : ""}${(r.growth * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── Hotspot Map ──────────────────────────────────────────────────── */}
      {!isLoading && activeTab === "map" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Map Metric:</span>
            {(["vlr", "growth", "gap"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMapMetric(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  mapMetric === m
                    ? "bg-amber-500 text-black"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "vlr" ? "VLR Rate" : m === "growth" ? "MoM Growth" : "MTD vs LMTD Gap"}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              Brand: <span className="font-semibold" style={{ color: selectedBrandVlr === "IM3" ? "#eab308" : "#e879f9" }}>{selectedBrandVlr}</span>
            </span>
          </div>

          <div className="chart-container p-0 overflow-hidden" style={{ height: 560 }}>
            <ChoroplethMap
              data={mapData}
              metric={mapMetric === "growth" ? "growth" : mapMetric === "gap" ? "gap" : "vlr"}
              title={`Kecamatan VLR Hotspot — ${selectedBrandVlr}`}
              className="h-full"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {["Top 5 VLR Growth", "Bottom 5 VLR Growth"].map((label) => {
              const brand = selectedBrandVlr === "IM3" ? "im3" : "threeid";
              const sorted = [...(kecRankQuery.data ?? [])].sort((a, b) => {
                const ag = Number((a as any)[`${brand}Gap`] ?? 0);
                const bg = Number((b as any)[`${brand}Gap`] ?? 0);
                return label.includes("Top") ? bg - ag : ag - bg;
              }).slice(0, 5);
              return (
                <div key={label} className="chart-container col-span-1 lg:col-span-2">
                  <h4 className={`text-xs font-semibold mb-3 flex items-center gap-1 ${
                    label.includes("Top") ? "value-positive" : "value-negative"
                  }`}>
                    {label.includes("Top") ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {label} — {selectedBrandVlr}
                  </h4>
                  <div className="space-y-2">
                    {sorted.map((r, i) => {
                      const gap = Number((r as any)[`${brand}Gap`] ?? 0);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium truncate max-w-[140px]">{r.kecamatan}</span>
                          <span className={`font-bold tabular-nums ${
                            gap >= 0 ? "value-positive" : "value-negative"
                          }`}>
                            {gap >= 0 ? "+" : ""}{(gap / 1000).toFixed(1)}K
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Kecamatan Ranking ───────────────────────────────────────────── */}
      {!isLoading && activeTab === "ranking" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Show top/bottom</span>
            <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
              <SelectTrigger className="h-7 w-20 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top VLR Growth */}
            <div className="chart-container">
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp size={14} className="text-positive value-positive" />
                  Top VLR Growth Kecamatan — {selectedBrandVlr}
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, topN * 22)}>
                <BarChart
                  data={kecTopBottom.top.map((r) => ({
                    name: r.kecamatan,
                    gap: Number((r as any)[`${selectedBrandVlr === "IM3" ? "im3" : "threeid"}Gap`] ?? 0) / 1000,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.75 0.02 250)" }} axisLine={false} tickLine={false} width={115} />
                  <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} />
                  <ReferenceLine x={0} stroke="oklch(0.40 0.04 250)" />
                  <Bar dataKey="gap" name="VLR Gap" radius={[0, 3, 3, 0]} maxBarSize={16}>
                    {kecTopBottom.top.map((_, i) => (
                      <Cell key={i} fill="oklch(0.68 0.18 145)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom VLR Growth */}
            <div className="chart-container">
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingDown size={14} className="value-negative" />
                  Bottom VLR Growth Kecamatan — {selectedBrandVlr}
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, topN * 22)}>
                <BarChart
                  data={kecTopBottom.bottom.map((r) => ({
                    name: r.kecamatan,
                    gap: Number((r as any)[`${selectedBrandVlr === "IM3" ? "im3" : "threeid"}Gap`] ?? 0) / 1000,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.75 0.02 250)" }} axisLine={false} tickLine={false} width={115} />
                  <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} />
                  <ReferenceLine x={0} stroke="oklch(0.40 0.04 250)" />
                  <Bar dataKey="gap" name="VLR Gap" radius={[0, 3, 3, 0]} maxBarSize={16}>
                    {kecTopBottom.bottom.map((_, i) => (
                      <Cell key={i} fill="oklch(0.60 0.20 25)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top HVC Growth */}
          <div className="chart-container">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp size={14} className="value-positive" />
                Top HVC Growth Kabupaten — {selectedBrandVlr}
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(200, topN * 22)}>
              <BarChart
                data={kecTopBottom.topHvc.map((r) => ({
                  name: `${r.kecamatan} (${r.kabkot})`,
                  gap: Number((r as any)[`${selectedBrandVlr === "IM3" ? "im3" : "threeid"}HvcGap`] ?? 0) / 1000,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.75 0.02 250)" }} axisLine={false} tickLine={false} width={155} />
                <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} />
                <ReferenceLine x={0} stroke="oklch(0.40 0.04 250)" />
                <Bar dataKey="gap" name="HVC Gap" radius={[0, 3, 3, 0]} maxBarSize={16} fill="oklch(0.78 0.16 75)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

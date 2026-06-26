import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useFilter } from "@/contexts/FilterContext";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import {
  monthLabel,
  TENURE_COLORS,
  SEGMENT_COLORS,
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
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-sm">
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
  // tenureBrand drives the VLR tenure query (IM3 or 3ID only — data is per-brand)
  const [tenureBrand, setTenureBrand] = useState<string>("IM3");
  // mapBrand drives the map/ranking views and supports IOH (combined)
  const [mapBrand, setMapBrand] = useState<string>("IOH");
  const [topN, setTopN] = useState(15);
  const [kecSortField, setKecSortField] = useState<"vlrGap" | "vlrMtd" | "vlrGrowth" | "hvcGap" | "hvcMtd">("vlrGap");
  const [kecSortDir, setKecSortDir] = useState<"asc" | "desc">("asc"); // asc = worst gap first

  // VLR Tenure data
  const vlrQuery = trpc.vlr.trend.useQuery({
    brands: [tenureBrand],
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
    const isNull = (v: string | null | undefined) => !v || v === 'NULL' || v === 'null';
    let totalRows = vlrQuery.data.filter(
      (r) => isNull(r.kecamatanNm) && isNull(r.kabkotNm)
    );
    if (totalRows.length === 0) {
      // Fall back: use kabkotNm='Total' rows and sum across kabkots
      totalRows = vlrQuery.data.filter(
        (r) => (r.kabkotNm === 'Total') && isNull(r.kecamatanNm)
      );
    }
    if (totalRows.length === 0) {
      // Last resort: sum all kecamatan rows (exclude 'Total' kabkot to avoid double-count)
      totalRows = vlrQuery.data.filter(
        (r) => r.kabkotNm !== 'Total' && !isNull(r.kabkotNm) && !isNull(r.kecamatanNm)
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
    const getBrandVal = (r: any, field: string) => mapBrand === "IOH"
      ? (Number(r[`im3${field}`] ?? 0) + Number(r[`threeid${field}`] ?? 0))
      : Number(r[`${mapBrand === "IM3" ? "im3" : "threeid"}${field}`] ?? 0);
    const sorted = [...kecRankQuery.data].sort((a, b) => {
      const aGap = getBrandVal(a as any, "Gap");
      const bGap = getBrandVal(b as any, "Gap");
      return bGap - aGap;
    });
    const top = sorted.slice(0, topN);
    const bottom = sorted.slice(-topN).reverse();

    const hvcSorted = [...kecRankQuery.data].sort((a, b) => {
      const aGap = getBrandVal(a as any, "HvcGap");
      const bGap = getBrandVal(b as any, "HvcGap");
      return bGap - aGap;
    });
    const topHvc = hvcSorted.slice(0, topN);

    return { top, bottom, topHvc };
  }, [kecRankQuery.data, mapBrand, topN]);

  // ─── Choropleth map data: kecamatan-level VLR from kecRank ─────────────────
  const mapData = useMemo(() => {
    if (!kecRankQuery.data) return [];
    const getVal = (rec: any, field: string) => mapBrand === "IOH"
      ? (Number(rec[`im3${field}`] ?? 0) + Number(rec[`threeid${field}`] ?? 0))
      : Number(rec[`${mapBrand === "IM3" ? "im3" : "threeid"}${field}`] ?? 0);
    return kecRankQuery.data
      .filter((r) => r.kecamatan && r.kecamatan !== "Total")
      .map((r) => {
        const rec = r as any;
        const mtd = getVal(rec, "Mtd");
        const lmtd = getVal(rec, "Lmtd");
        const gap = getVal(rec, "Gap");
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
  }, [kecRankQuery.data, mapBrand, mapMetric]);

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
          <span className="text-sm text-muted-foreground">Tenure:</span>
          <Select value={tenureBrand} onValueChange={setTenureBrand}>
            <SelectTrigger className="h-7 w-24 text-sm bg-secondary border-border">
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
          <TabsTrigger value="tenure" className="text-sm">VLR Tenure Analysis</TabsTrigger>
          <TabsTrigger value="segments" className="text-sm">Subscriber Segments</TabsTrigger>
          <TabsTrigger value="ranking" className="text-sm">Kecamatan Ranking</TabsTrigger>
          <TabsTrigger value="map" className="text-sm flex items-center gap-1"><MapIcon size={12} />Hotspot Map</TabsTrigger>
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
      {!isLoading && activeTab === "tenure" && (() => {
        if (vlrTrendData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Wifi className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No VLR data available</p>
              </div>
            </div>
          );
        }
        const latest = vlrTrendData[vlrTrendData.length - 1];
        const prev   = vlrTrendData[vlrTrendData.length - 2];
        const totalMtd  = TENURE_GROUPS.reduce((s, tg) => s + (Number(latest?.[tg] ?? 0)), 0);
        const totalLmtd = TENURE_GROUPS.reduce((s, tg) => s + (Number(prev?.[tg]   ?? 0)), 0);
        const tableRows = TENURE_GROUPS.map((tg) => {
          const mtd  = Number(latest?.[tg] ?? 0) * 1000;
          const lmtd = Number(prev?.[tg]   ?? 0) * 1000;
          const gap  = mtd - lmtd;
          const growth = lmtd !== 0 ? (gap / Math.abs(lmtd)) * 100 : 0;
          const mixMtd  = totalMtd  !== 0 ? (Number(latest?.[tg] ?? 0) / totalMtd)  * 100 : 0;
          const mixLmtd = totalLmtd !== 0 ? (Number(prev?.[tg]   ?? 0) / totalLmtd) * 100 : 0;
          const mixShift = mixMtd - mixLmtd;
          return { tg, mtd, lmtd, gap, growth, mixMtd, mixLmtd, mixShift };
        });
        const totMtdSubs  = totalMtd  * 1000;
        const totLmtdSubs = totalLmtd * 1000;
        const totGap   = totMtdSubs - totLmtdSubs;
        const totGrowth = totLmtdSubs !== 0 ? (totGap / Math.abs(totLmtdSubs)) * 100 : 0;

        return (
          <div className="chart-container overflow-x-auto">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                VLR Daily Average by Tenure Group — {tenureBrand}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                MTD vs LMTD · values in subscribers · Mix % = share of total VLR
              </p>
            </div>
            <table className="w-full text-sm data-table min-w-[780px]">
              <thead>
                <tr>
                  <th className="text-left py-2.5 px-4 rounded-l-md w-[160px]">Tenure Group</th>
                  <th className="text-right py-2.5 px-3">MTD (Subs)</th>
                  <th className="text-right py-2.5 px-3">Mix MTD %</th>
                  <th className="text-right py-2.5 px-3">LMTD (Subs)</th>
                  <th className="text-right py-2.5 px-3">Mix LMTD %</th>
                  <th className="text-right py-2.5 px-3">Mix Shift</th>
                  <th className="text-right py-2.5 px-3">GAP (MTD−LMTD)</th>
                  <th className="text-right py-2.5 px-4 rounded-r-md">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.tg} className="border-t border-border/20 hover:bg-accent/10 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TENURE_COLORS[r.tg] }} />
                        <span className="text-foreground/90">{r.tg}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {formatNumber(r.mtd / 1000, 1)}K
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-semibold">
                      {r.mixMtd.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatNumber(r.lmtd / 1000, 1)}K
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {r.mixLmtd.toFixed(1)}%
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold text-sm ${
                      r.mixShift > 0.1 ? "value-positive" : r.mixShift < -0.1 ? "value-negative" : "text-muted-foreground"
                    }`}>
                      {r.mixShift >= 0 ? "+" : ""}{r.mixShift.toFixed(1)} pp
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${
                      r.gap >= 0 ? "value-positive" : "value-negative"
                    }`}>
                      {r.gap >= 0 ? "+" : ""}{formatNumber(r.gap / 1000, 1)}K
                    </td>
                    <td className={`py-2.5 px-4 text-right ${
                      r.growth >= 0 ? "value-positive" : "value-negative"
                    }`}>
                      {r.growth >= 0 ? "↗" : "↘"} {r.growth >= 0 ? "+" : ""}{r.growth.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="border-t-2 border-border/40 bg-accent/5 font-semibold">
                  <td className="py-2.5 px-4 text-foreground">Total VLR</td>
                  <td className="py-2.5 px-3 text-right">{formatNumber(totMtdSubs / 1000, 1)}K</td>
                  <td className="py-2.5 px-3 text-right text-amber-400">100.0%</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{formatNumber(totLmtdSubs / 1000, 1)}K</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">100.0%</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">—</td>
                  <td className={`py-2.5 px-3 text-right ${
                    totGap >= 0 ? "value-positive" : "value-negative"
                  }`}>
                    {totGap >= 0 ? "+" : ""}{formatNumber(totGap / 1000, 1)}K
                  </td>
                  <td className={`py-2.5 px-4 text-right ${
                    totGrowth >= 0 ? "value-positive" : "value-negative"
                  }`}>
                    {totGrowth >= 0 ? "↗" : "↘"} {totGrowth >= 0 ? "+" : ""}{totGrowth.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

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
              <table className="w-full text-sm data-table">
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
                        <span className={`px-2 py-0.5 rounded text-sm font-medium ${r.brand === "IM3" ? "badge-im3" : "badge-3id"}`}>
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
            <span className="text-sm text-muted-foreground font-medium">Map Metric:</span>
            {(["vlr", "growth", "gap"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMapMetric(m)}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                  mapMetric === m
                    ? "bg-amber-500 text-black"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "vlr" ? "VLR Rate" : m === "growth" ? "MoM Growth" : "MTD vs LMTD Gap"}
              </button>
            ))}
            <span className="text-sm text-muted-foreground ml-2">Brand:</span>
            {(["IM3", "3ID", "IOH"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setMapBrand(b)}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                  mapBrand === b
                    ? b === "IM3" ? "bg-yellow-500 text-black" : b === "3ID" ? "bg-fuchsia-500 text-white" : "bg-blue-500 text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {b === "IOH" ? "IOH (Combined)" : b}
              </button>
            ))}
          </div>

          <div className="chart-container p-0 overflow-hidden" style={{ height: 560 }}>
            <ChoroplethMap
              data={mapData}
              metric={mapMetric === "growth" ? "growth" : mapMetric === "gap" ? "gap" : "vlr"}
              title={`Kecamatan VLR Hotspot — ${mapBrand}`}
              className="h-full"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {["Top 5 VLR Growth", "Bottom 5 VLR Growth"].map((label) => {
              const getBV = (r: any) => mapBrand === "IOH"
                ? (Number(r.im3Gap ?? 0) + Number(r.threeidGap ?? 0))
                : Number(r[`${mapBrand === "IM3" ? "im3" : "threeid"}Gap`] ?? 0);
              const sorted = [...(kecRankQuery.data ?? [])].sort((a, b) => {
                const ag = getBV(a as any);
                const bg = getBV(b as any);
                return label.includes("Top") ? bg - ag : ag - bg;
              }).slice(0, 5);
              return (
                <div key={label} className="chart-container col-span-1 lg:col-span-2">
                  <h4 className={`text-sm font-semibold mb-3 flex items-center gap-1 ${
                    label.includes("Top") ? "value-positive" : "value-negative"
                  }`}>
                    {label.includes("Top") ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {label} — {mapBrand}
                  </h4>
                  <div className="space-y-2">
                    {sorted.map((r, i) => {
                      const gap = getBV(r as any);
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
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
            <span className="text-sm text-muted-foreground">Show top/bottom</span>
            <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
              <SelectTrigger className="h-7 w-20 text-sm bg-secondary border-border">
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
                  Top VLR Growth Kecamatan — {mapBrand}
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, topN * 22)}>
                <BarChart
                  data={kecTopBottom.top.map((r) => ({
                    name: r.kecamatan,
                    gap: mapBrand === "IOH"
                      ? (Number((r as any).im3Gap ?? 0) + Number((r as any).threeidGap ?? 0)) / 1000
                      : Number((r as any)[`${mapBrand === "IM3" ? "im3" : "threeid"}Gap`] ?? 0) / 1000,
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
                  Bottom VLR Growth Kecamatan — {mapBrand}
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, topN * 22)}>
                <BarChart
                  data={kecTopBottom.bottom.map((r) => ({
                    name: r.kecamatan,
                    gap: mapBrand === "IOH"
                      ? (Number((r as any).im3Gap ?? 0) + Number((r as any).threeidGap ?? 0)) / 1000
                      : Number((r as any)[`${mapBrand === "IM3" ? "im3" : "threeid"}Gap`] ?? 0) / 1000,
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
                Top HVC Growth Kabupaten — {mapBrand}
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(200, topN * 22)}>
              <BarChart
                data={kecTopBottom.topHvc.map((r) => ({
                  name: `${r.kecamatan} (${r.kabkot})`,
                  gap: mapBrand === "IOH"
                      ? (Number((r as any).im3HvcGap ?? 0) + Number((r as any).threeidHvcGap ?? 0)) / 1000
                      : Number((r as any)[`${mapBrand === "IM3" ? "im3" : "threeid"}HvcGap`] ?? 0) / 1000,
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

      {/* ─── Kecamatan Drill-Down Ranked Table ──────────────────────────────── */}
      {!isLoading && kecRankQuery.data && (() => {
        const hasKabkot = !!filter.kabkot;
        const hasArea   = !!filter.area;
        if (!hasKabkot && !hasArea) return (
          <div className="chart-container">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users size={14} />
              <span>Select a <strong className="text-foreground">Kabupaten</strong> or <strong className="text-foreground">Sales Area</strong> in the filter above to see the Kecamatan ranked drill-down.</span>
            </div>
          </div>
        );

        const getV = (r: any, field: string) => mapBrand === "IOH"
          ? (Number(r[`im3${field}`] ?? 0) + Number(r[`threeid${field}`] ?? 0))
          : Number(r[`${mapBrand === "IM3" ? "im3" : "threeid"}${field}`] ?? 0);

        const rows = kecRankQuery.data
          .filter((r) => r.kecamatan && r.kecamatan !== "Total")
          .map((r) => {
            const vlrMtd   = getV(r, "Mtd");
            const vlrLmtd  = getV(r, "Lmtd");
            const vlrGap   = getV(r, "Gap");
            const hvcMtd   = getV(r, "HvcMtd");
            const hvcLmtd  = getV(r, "HvcLmtd");
            const hvcGap   = getV(r, "HvcGap");
            const vlrGrowth = vlrLmtd !== 0 ? (vlrGap / Math.abs(vlrLmtd)) * 100 : 0;
            const hvcGrowth = hvcLmtd !== 0 ? (hvcGap / Math.abs(hvcLmtd)) * 100 : 0;
            const vlrRate   = vlrLmtd > 0 ? (vlrMtd / vlrLmtd) * 100 : null;
            return {
              kecamatan: r.kecamatan,
              kabkot: r.kabkot ?? "",
              area: r.area ?? "",
              vlrMtd, vlrLmtd, vlrGap, vlrGrowth, vlrRate,
              hvcMtd, hvcLmtd, hvcGap, hvcGrowth,
            };
          });

        const sorted = [...rows].sort((a, b) => {
          const va = a[kecSortField];
          const vb = b[kecSortField];
          return kecSortDir === "asc" ? (va ?? 0) - (vb ?? 0) : (vb ?? 0) - (va ?? 0);
        });

        const toggleSort = (field: typeof kecSortField) => {
          if (kecSortField === field) setKecSortDir(d => d === "asc" ? "desc" : "asc");
          else { setKecSortField(field); setKecSortDir("asc"); }
        };
        const sortIcon = (field: typeof kecSortField) =>
          kecSortField === field ? (kecSortDir === "asc" ? " ↑" : " ↓") : " ↕";

        const scopeLabel = filter.kabkot
          ? filter.kabkot
          : filter.area
          ? filter.area
          : "All";

        return (
          <div className="chart-container overflow-x-auto">
            <div className="section-header mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users size={14} className="text-amber-400" />
                Kecamatan VLR Drill-Down — {scopeLabel} · {mapBrand}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ranked by VLR GAP (MTD − LMTD) · Click column headers to re-sort · {sorted.length} kecamatan
              </p>
            </div>
            <table className="w-full text-sm data-table min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left py-2.5 px-4 rounded-l-md w-8">#</th>
                  <th className="text-left py-2.5 px-4">Kecamatan</th>
                  <th className="text-left py-2.5 px-3">Kabupaten</th>
                  <th
                    className="text-right py-2.5 px-3 cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("vlrMtd")}
                  >
                    VLR MTD (K){sortIcon("vlrMtd")}
                  </th>
                  <th className="text-right py-2.5 px-3">VLR LMTD (K)</th>
                  <th
                    className="text-right py-2.5 px-3 cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("vlrGap")}
                  >
                    VLR GAP{sortIcon("vlrGap")}
                  </th>
                  <th
                    className="text-right py-2.5 px-3 cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("vlrGrowth")}
                  >
                    Growth %{sortIcon("vlrGrowth")}
                  </th>
                  <th className="text-right py-2.5 px-3">VLR Rate</th>
                  <th
                    className="text-right py-2.5 px-3 cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("hvcMtd")}
                  >
                    HVC MTD (K){sortIcon("hvcMtd")}
                  </th>
                  <th className="text-right py-2.5 px-3">HVC LMTD (K)</th>
                  <th
                    className="text-right py-2.5 px-3 cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("hvcGap")}
                  >
                    HVC GAP{sortIcon("hvcGap")}
                  </th>
                  <th className="text-right py-2.5 px-4 rounded-r-md">HVC Growth %</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const vlrBad = r.vlrGap < 0;
                  const hvcBad = r.hvcGap < 0;
                  return (
                    <tr
                      key={r.kecamatan}
                      className={`border-t border-border/20 hover:bg-accent/10 transition-colors ${
                        vlrBad && r.vlrGap < -500 ? "bg-red-950/20" : ""
                      }`}
                    >
                      <td className="py-2 px-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-4 font-medium text-foreground">{r.kecamatan}</td>
                      <td className="py-2 px-3 text-muted-foreground text-[11px]">{r.kabkot}</td>
                      <td className="py-2 px-3 text-right font-medium">{(r.vlrMtd / 1000).toFixed(1)}K</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{(r.vlrLmtd / 1000).toFixed(1)}K</td>
                      <td className={`py-2 px-3 text-right font-semibold ${
                        r.vlrGap >= 0 ? "value-positive" : "value-negative"
                      }`}>
                        {r.vlrGap >= 0 ? "+" : ""}{(r.vlrGap / 1000).toFixed(1)}K
                      </td>
                      <td className={`py-2 px-3 text-right ${
                        r.vlrGrowth >= 0 ? "value-positive" : "value-negative"
                      }`}>
                        {r.vlrGrowth >= 0 ? "↗ +" : "↘ "}{r.vlrGrowth.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right">
                        {r.vlrRate !== null ? (
                          <span className={r.vlrRate >= 100 ? "value-positive" : r.vlrRate >= 95 ? "text-amber-400" : "value-negative"}>
                            {r.vlrRate.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{(r.hvcMtd / 1000).toFixed(1)}K</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{(r.hvcLmtd / 1000).toFixed(1)}K</td>
                      <td className={`py-2 px-3 text-right font-semibold ${
                        r.hvcGap >= 0 ? "value-positive" : "value-negative"
                      }`}>
                        {r.hvcGap >= 0 ? "+" : ""}{(r.hvcGap / 1000).toFixed(1)}K
                      </td>
                      <td className={`py-2 px-4 text-right ${
                        r.hvcGrowth >= 0 ? "value-positive" : "value-negative"
                      }`}>
                        {r.hvcGrowth >= 0 ? "↗ +" : "↘ "}{r.hvcGrowth.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

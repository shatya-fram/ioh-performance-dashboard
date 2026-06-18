import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useFilter } from "@/contexts/FilterContext";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import { formatNumber, formatPercent, monthLabel, BRAND_COLORS } from "@/lib/kpiUtils";
import {
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
  ComposedChart,
  Line,
} from "recharts";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";

// ─── Waterfall Chart ──────────────────────────────────────────────────────────
// Shows: LMTD Base (total) → gap components → MTD Total (total)
// The invisible 'start' bar stacks below each gap component to position it correctly
function WaterfallChart({ data }: { data: Array<{ name: string; value: number; isTotal?: boolean }> }) {
  let running = 0;
  const chartData = data.map((d) => {
    if (d.isTotal) {
      // Total bars start from 0 and show the full value
      return {
        ...d,
        start: 0,
        bar: d.value,
        displayValue: d.value,
        fill: d.value >= 0 ? "oklch(0.78 0.16 75)" : "oklch(0.60 0.20 25)",
      };
    }
    // For gap bars: position them using the running total as the base
    const start = d.value >= 0 ? running : running + d.value;
    const bar = Math.abs(d.value);
    running += d.value;
    return {
      ...d,
      start,
      bar,
      displayValue: d.value,
      fill: d.value >= 0 ? "oklch(0.68 0.18 145)" : "oklch(0.60 0.20 25)",
    };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }}
          axisLine={false}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }}
          axisLine={false}
          tickLine={false}
          width={70}
          tickFormatter={(v) => `${formatNumber(v / 1e9, 1)}B`}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.14 0.022 250)",
            border: "1px solid oklch(0.25 0.03 250)",
            borderRadius: "8px",
            fontSize: "11px",
          }}
          formatter={(_value: any, _name: any, props: any) => {
            const v = props.payload.displayValue;
            const abs = Math.abs(v);
            const sign = v >= 0 ? "+" : "-";
            const formatted = abs >= 1e9 ? `${sign}${(abs / 1e9).toFixed(2)} Bn IDR` : `${sign}${(abs / 1e6).toFixed(1)} Mn IDR`;
            return [formatted, props.payload.name];
          }}
        />
        <ReferenceLine y={0} stroke="oklch(0.40 0.04 250)" strokeWidth={1} />
        {/* Invisible base bar for stacking waterfall position */}
        <Bar dataKey="start" fill="transparent" stackId="waterfall" isAnimationActive={false} />
        <Bar dataKey="bar" stackId="waterfall" radius={[3, 3, 0, 0]} maxBarSize={50} isAnimationActive={false}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Gap Driver Summary Card ──────────────────────────────────────────────────
function GapDriverCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; unit: string; isPositive?: boolean }>;
}) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs text-foreground/80">{item.label}</span>
            <span
              className={`text-sm font-semibold ${
                item.isPositive === undefined
                  ? "text-foreground"
                  : item.isPositive
                  ? "value-positive"
                  : "value-negative"
              }`}
            >
              {item.isPositive !== undefined && (item.value >= 0 ? "+" : "")}
              {(() => {
                const abs = Math.abs(item.value);
                const sign = item.value < 0 ? "-" : "";
                if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
                if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
                if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
                return `${sign}${abs.toFixed(1)}`;
              })()}{" "}
              {item.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ANOVAAnalysis() {
  const { filter, brandsArray, areasArray, salesAreasArray, kabkotsArray, setNormalizeVoucher } = useFilter();
  const [activeTab, setActiveTab] = useState<"brand" | "branch" | "channel" | "stream" | "vlr">("brand");

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

  const voucherQuery = trpc.voucherGame.data.useQuery({
    brands: brandsArray,
    areas: areasArray.length ? areasArray : undefined,
  });

  // ─── Aggregate helpers ────────────────────────────────────────────────────
  const months = useMemo(() => {
    if (!fmQuery.data) return [];
    return Array.from(new Set(fmQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
  }, [fmQuery.data]);

  const latestMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  // Aggregate by dimension
  const aggregateByDim = (
    data: any[],
    dimField: string,
    valueField: string,
    monthFilter?: string
  ) => {
    const map = new Map<string, number>();
    for (const row of (data as any[])) {
      if (monthFilter && String(row.yearMonth ?? "") !== monthFilter) continue;
      const dim = String(row[dimField] ?? "Unknown");
      map.set(dim, (map.get(dim) ?? 0) + (Number(row[valueField]) || 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  };

  // Voucher game effect
  const voucherEffect = useMemo(() => {
    if (!voucherQuery.data) return 0;
    return (voucherQuery.data as any[])
      .filter((r) => String(r.yearMonth ?? "") === latestMonth)
      .reduce((s: number, r: any) => s + (Number(r.totalEffect) || 0), 0);
  }, [voucherQuery.data, latestMonth]);

  // Revenue by brand (MTD vs LMTD)
  const revByBrand = useMemo(() => {
    if (!mtdQuery.data) return [];
    const allMonths = Array.from(new Set(mtdQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    const latestM = allMonths[allMonths.length - 1];
    const prevM = allMonths[allMonths.length - 2];
    const brands2 = Array.from(new Set(mtdQuery.data.map((r) => String(r.brand ?? ""))));
    return brands2.map((brand) => {
      const mtd = mtdQuery.data!
        .filter((r) => String(r.brand ?? "") === brand && String(r.yearMonth ?? "") === latestM)
        .reduce((s: number, r) => s + (Number(r.revPrepaid) || 0), 0);
      const lmtd = mtdQuery.data!
        .filter((r) => String(r.brand ?? "") === brand && String(r.yearMonth ?? "") === prevM)
        .reduce((s: number, r) => s + (Number(r.revPrepaid) || 0), 0);
      const gap = mtd - lmtd;
      return { name: brand, MTD: mtd, LMTD: lmtd, gap, growth: lmtd ? (gap / lmtd) * 100 : 0 };
    });
  }, [mtdQuery.data, latestMonth]);

  // Revenue by branch
  const revByBranch = useMemo(() => {
    if (!mtdQuery.data) return [];
    const branchMap = new Map<string, { mtd: number; lmtd: number }>();
    const months2 = Array.from(new Set(mtdQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    const latest = months2[months2.length - 1];
    const prev = months2[months2.length - 2];
    for (const row of mtdQuery.data) {
      const branch = String((row as any).salesArea ?? "Unknown");
      const ym = String(row.yearMonth ?? "");
      if (!branchMap.has(branch)) branchMap.set(branch, { mtd: 0, lmtd: 0 });
      const e = branchMap.get(branch)!;
      if (ym === latest) e.mtd += Number(row.revPrepaid) || 0;
      if (ym === prev) e.lmtd += Number(row.revPrepaid) || 0;
    }
    return Array.from(branchMap.entries())
      .map(([name, v]) => ({
        name,
        MTD: v.mtd,
        LMTD: v.lmtd,
        gap: v.mtd - v.lmtd,
        growth: v.lmtd ? ((v.mtd - v.lmtd) / v.lmtd) * 100 : 0,
      }))
      .sort((a, b) => a.gap - b.gap);
  }, [mtdQuery.data]);

  // Revenue by channel
  const revByChannel = useMemo(() => {
    if (!mtdQuery.data) return [];
    const months2 = Array.from(new Set(mtdQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    const latest = months2[months2.length - 1];
    const prev = months2[months2.length - 2];
    const channels = [
      { key: "revTrade", label: "Trade" },
      { key: "revNonTrade", label: "Non-Trade" },
      { key: "revOrganic", label: "Organic" },
      { key: "revVsd", label: "VSD" },
    ];
    return channels.map(({ key, label }) => {
      const mtd = mtdQuery.data!
        .filter((r) => String(r.yearMonth ?? "") === latest)
        .reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);
      const lmtd = mtdQuery.data!
        .filter((r) => String(r.yearMonth ?? "") === prev)
        .reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);
      const gap = mtd - lmtd;
      return { name: label, MTD: mtd, LMTD: lmtd, gap, growth: lmtd ? (gap / lmtd) * 100 : 0 };
    });
  }, [mtdQuery.data]);

  // Revenue by stream (Acq vs Base)
  const revByStream = useMemo(() => {
    if (!mtdQuery.data) return [];
    const months2 = Array.from(new Set(mtdQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    const latest = months2[months2.length - 1];
    const prev = months2[months2.length - 2];
    const streams = [
      { key: "revAcqM0", label: "Acquisition" },
      { key: "revBase", label: "Base" },
    ];
    return streams.map(({ key, label }) => {
      const mtd = mtdQuery.data!
        .filter((r) => String(r.yearMonth ?? "") === latest)
        .reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);
      const lmtd = mtdQuery.data!
        .filter((r) => String(r.yearMonth ?? "") === prev)
        .reduce((s, r) => s + (Number((r as any)[key]) || 0), 0);
      const gap = mtd - lmtd;
      return { name: label, MTD: mtd, LMTD: lmtd, gap, growth: lmtd ? (gap / lmtd) * 100 : 0 };
    });
  }, [mtdQuery.data]);

  // VLR gap by branch
  const vlrByBranch = useMemo(() => {
    if (!mtdQuery.data) return [];
    const months2 = Array.from(new Set(mtdQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    const latest = months2[months2.length - 1];
    const prev = months2[months2.length - 2];
    const branchMap = new Map<string, { mtd: number; lmtd: number }>();
    for (const row of mtdQuery.data) {
      const branch = String((row as any).salesArea ?? "Unknown");
      const ym = String(row.yearMonth ?? "");
      if (!branchMap.has(branch)) branchMap.set(branch, { mtd: 0, lmtd: 0 });
      const e = branchMap.get(branch)!;
      if (ym === latest) e.mtd += Number(row.subsAvgVlrDaily) || 0;
      if (ym === prev) e.lmtd += Number(row.subsAvgVlrDaily) || 0;
    }
    return Array.from(branchMap.entries())
      .map(([name, v]) => ({
        name,
        MTD: v.mtd / 1000,
        LMTD: v.lmtd / 1000,
        gap: (v.mtd - v.lmtd) / 1000,
        growth: v.lmtd ? ((v.mtd - v.lmtd) / v.lmtd) * 100 : 0,
      }))
      .sort((a, b) => a.gap - b.gap);
  }, [mtdQuery.data]);

  // Waterfall data
  const waterfallData = useMemo(() => {
    const totalMtd = revByBrand.reduce((s, r) => s + r.MTD, 0);
    const totalLmtd = revByBrand.reduce((s, r) => s + r.LMTD, 0);
    const totalGap = totalMtd - totalLmtd;

    const items = [
      { name: "LMTD Base", value: totalLmtd, isTotal: false },
      ...revByChannel.map((c) => ({ name: c.name, value: c.gap, isTotal: false })),
      { name: "MTD Total", value: totalMtd, isTotal: true },
    ];

    if (filter.normalizeVoucher && voucherEffect !== 0) {
      items.splice(items.length - 1, 0, {
        name: "Voucher Game",
        value: -voucherEffect,
        isTotal: false,
      });
    }

    return items;
  }, [revByBrand, revByChannel, filter.normalizeVoucher, voucherEffect]);

  // Gap driver summary
  const totalMtdRev = revByBrand.reduce((s, r) => s + r.MTD, 0);
  const totalLmtdRev = revByBrand.reduce((s, r) => s + r.LMTD, 0);
  const totalRevGap = totalMtdRev - totalLmtdRev;

  const totalMtdVlr = vlrByBranch.reduce((s, r) => s + r.MTD, 0);
  const totalLmtdVlr = vlrByBranch.reduce((s, r) => s + r.LMTD, 0);

  const isLoading = fmQuery.isLoading || mtdQuery.isLoading;

  const GapBar = ({ items, valueKey = "gap" }: { items: any[]; valueKey?: string }) => (
    <ResponsiveContainer width="100%" height={Math.max(200, items.length * 32)}>
      <BarChart
        data={items}
        layout="vertical"
        margin={{ top: 5, right: 80, left: 120, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatNumber(v / 1e9, 1)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: "oklch(0.75 0.02 250)" }}
          axisLine={false}
          tickLine={false}
          width={115}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.14 0.022 250)",
            border: "1px solid oklch(0.25 0.03 250)",
            borderRadius: "8px",
            fontSize: "11px",
          }}
          formatter={(v: any) => [`${formatNumber(v / 1e9, 2)} Bn IDR`, "Gap"]}
        />
        <ReferenceLine x={0} stroke="oklch(0.40 0.04 250)" />
        <Bar dataKey={valueKey} name="Gap" radius={[0, 3, 3, 0]} maxBarSize={20}>
          {items.map((entry, i) => (
            <Cell key={i} fill={entry[valueKey] >= 0 ? "oklch(0.68 0.18 145)" : "oklch(0.60 0.20 25)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="section-header mb-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">ANOVA Revenue Analysis</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Variance analysis — identify missing revenue drivers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="normalize"
              checked={filter.normalizeVoucher}
              onCheckedChange={(v) => setNormalizeVoucher(v)}
            />
            <Label htmlFor="normalize" className="text-xs text-muted-foreground cursor-pointer">
              Normalize (excl. Voucher Game)
            </Label>
          </div>
        </div>
      </div>

      <GlobalFilterBar />

      {/* Gap Driver Summary */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GapDriverCard
            title="Revenue Gap"
            items={[
              { label: "MTD Revenue", value: totalMtdRev, unit: "IDR", isPositive: undefined },
              { label: "LMTD Revenue", value: totalLmtdRev, unit: "IDR", isPositive: undefined },
              { label: "GAP", value: totalRevGap, unit: "IDR", isPositive: totalRevGap >= 0 },
            ]}
          />
          <GapDriverCard
            title="VLR Gap"
            items={[
              { label: "MTD VLR", value: totalMtdVlr, unit: "K", isPositive: undefined },
              { label: "LMTD VLR", value: totalLmtdVlr, unit: "K", isPositive: undefined },
              { label: "GAP", value: totalMtdVlr - totalLmtdVlr, unit: "K", isPositive: totalMtdVlr >= totalLmtdVlr },
            ]}
          />
          <GapDriverCard
            title="Acquisition Gap"
            items={[
              { label: "MTD Acq Rev", value: revByStream.find((r) => r.name === "Acquisition")?.MTD ?? 0, unit: "IDR", isPositive: undefined },
              { label: "LMTD Acq Rev", value: revByStream.find((r) => r.name === "Acquisition")?.LMTD ?? 0, unit: "IDR", isPositive: undefined },
              { label: "GAP", value: revByStream.find((r) => r.name === "Acquisition")?.gap ?? 0, unit: "IDR", isPositive: (revByStream.find((r) => r.name === "Acquisition")?.gap ?? 0) >= 0 },
            ]}
          />
          <GapDriverCard
            title="Base Revenue Gap"
            items={[
              { label: "MTD Base Rev", value: revByStream.find((r) => r.name === "Base")?.MTD ?? 0, unit: "IDR", isPositive: undefined },
              { label: "LMTD Base Rev", value: revByStream.find((r) => r.name === "Base")?.LMTD ?? 0, unit: "IDR", isPositive: undefined },
              { label: "GAP", value: revByStream.find((r) => r.name === "Base")?.gap ?? 0, unit: "IDR", isPositive: (revByStream.find((r) => r.name === "Base")?.gap ?? 0) >= 0 },
            ]}
          />
        </div>
      )}

      {/* Waterfall Chart */}
      {!isLoading && (
        <div className="chart-container">
          <div className="section-header mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Revenue Bridge — LMTD to MTD
              {filter.normalizeVoucher && (
                <span className="ml-2 text-xs text-muted-foreground">(excl. Voucher Game)</span>
              )}
            </h3>
          </div>
          <WaterfallChart data={waterfallData} />
        </div>
      )}

      {/* Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="brand" className="text-xs">By Brand</TabsTrigger>
          <TabsTrigger value="branch" className="text-xs">By Branch</TabsTrigger>
          <TabsTrigger value="channel" className="text-xs">By Channel</TabsTrigger>
          <TabsTrigger value="stream" className="text-xs">By Stream</TabsTrigger>
          <TabsTrigger value="vlr" className="text-xs">VLR by Branch</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="chart-container h-64">
          <div className="skeleton h-full w-full" />
        </div>
      )}

      {!isLoading && (
        <div className="chart-container">
          {activeTab === "brand" && (
            <>
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground">Revenue Gap by Brand</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revByBrand} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => formatNumber(v / 1e9, 1)} />
                  <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} formatter={(v: any) => [`${formatNumber(v / 1e9, 2)} Bn IDR`]} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <ReferenceLine y={0} stroke="oklch(0.40 0.04 250)" />
                  <Bar dataKey="MTD" name="MTD" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {revByBrand.map((entry, i) => (
                      <Cell key={i} fill={BRAND_COLORS[entry.name] ?? "oklch(0.78 0.16 75)"} />
                    ))}
                  </Bar>
                  <Bar dataKey="LMTD" name="LMTD" fill="oklch(0.35 0.03 250)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs data-table">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 rounded-l-md">Brand</th>
                      <th className="text-right py-2 px-3">MTD (Bn)</th>
                      <th className="text-right py-2 px-3">LMTD (Bn)</th>
                      <th className="text-right py-2 px-3">GAP (Bn)</th>
                      <th className="text-right py-2 px-3 rounded-r-md">Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revByBrand.map((r, i) => (
                      <tr key={i} className="border-t border-border/30 hover:bg-accent/20">
                        <td className="py-2 px-3 font-medium">
                          <span className={`px-2 py-0.5 rounded text-xs ${r.name === "IM3" ? "badge-im3" : "badge-3id"}`}>{r.name}</span>
                        </td>
                        <td className="py-2 px-3 text-right">{formatNumber(r.MTD / 1e9, 2)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(r.LMTD / 1e9, 2)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${r.gap >= 0 ? "value-positive" : "value-negative"}`}>
                          {r.gap >= 0 ? "+" : ""}{formatNumber(r.gap / 1e9, 2)}
                        </td>
                        <td className={`py-2 px-3 text-right ${r.growth >= 0 ? "value-positive" : "value-negative"}`}>
                          {r.growth >= 0 ? "+" : ""}{r.growth.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "branch" && (
            <>
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground">Revenue Gap by Branch (MTD vs LMTD)</h3>
              </div>
              <GapBar items={revByBranch} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs data-table">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 rounded-l-md">Branch</th>
                      <th className="text-right py-2 px-3">MTD (Bn)</th>
                      <th className="text-right py-2 px-3">LMTD (Bn)</th>
                      <th className="text-right py-2 px-3">GAP (Bn)</th>
                      <th className="text-right py-2 px-3 rounded-r-md">Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...revByBranch].sort((a, b) => a.gap - b.gap).map((r, i) => (
                      <tr key={i} className="border-t border-border/30 hover:bg-accent/20">
                        <td className="py-2 px-3 font-medium text-foreground">{r.name}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(r.MTD / 1e9, 2)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(r.LMTD / 1e9, 2)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${r.gap >= 0 ? "value-positive" : "value-negative"}`}>
                          {r.gap >= 0 ? "+" : ""}{formatNumber(r.gap / 1e9, 2)}
                        </td>
                        <td className={`py-2 px-3 text-right ${r.growth >= 0 ? "value-positive" : "value-negative"}`}>
                          {r.growth >= 0 ? "+" : ""}{r.growth.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "channel" && (
            <>
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground">Revenue Gap by Channel</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revByChannel} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => formatNumber(v / 1e9, 1)} />
                  <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} formatter={(v: any) => [`${formatNumber(v / 1e9, 2)} Bn IDR`]} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <ReferenceLine y={0} stroke="oklch(0.40 0.04 250)" />
                  <Bar dataKey="MTD" name="MTD" fill="oklch(0.78 0.16 75)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="LMTD" name="LMTD" fill="oklch(0.35 0.03 250)" radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {activeTab === "stream" && (
            <>
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground">Revenue Gap by Stream (Acquisition vs Base)</h3>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revByStream} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => formatNumber(v / 1e9, 1)} />
                  <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} formatter={(v: any) => [`${formatNumber(v / 1e9, 2)} Bn IDR`]} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <ReferenceLine y={0} stroke="oklch(0.40 0.04 250)" />
                  <Bar dataKey="MTD" name="MTD" fill="oklch(0.65 0.18 220)" radius={[3, 3, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="LMTD" name="LMTD" fill="oklch(0.35 0.03 250)" radius={[3, 3, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {activeTab === "vlr" && (
            <>
              <div className="section-header mb-4">
                <h3 className="text-sm font-semibold text-foreground">VLR Gap by Branch (MTD vs LMTD)</h3>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, vlrByBranch.length * 32)}>
                <BarChart
                  data={vlrByBranch}
                  layout="vertical"
                  margin={{ top: 5, right: 80, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.60 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.75 0.02 250)" }} axisLine={false} tickLine={false} width={115} />
                  <Tooltip contentStyle={{ background: "oklch(0.14 0.022 250)", border: "1px solid oklch(0.25 0.03 250)", borderRadius: "8px", fontSize: "11px" }} formatter={(v: any) => [`${v.toFixed(1)}K`, "VLR"]} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <ReferenceLine x={0} stroke="oklch(0.40 0.04 250)" />
                  <Bar dataKey="MTD" name="MTD" fill="oklch(0.70 0.18 160)" radius={[0, 3, 3, 0]} maxBarSize={16} />
                  <Bar dataKey="LMTD" name="LMTD" fill="oklch(0.35 0.03 250)" radius={[0, 3, 3, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

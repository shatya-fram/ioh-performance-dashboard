import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtRev(v: number | null | undefined) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(2) + " T";
  if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + " Bn";
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + " Mn";
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + " K";
  return v.toFixed(0);
}

function calcGrowth(mtd: number, lmtd: number) {
  if (!lmtd) return null;
  return ((mtd - lmtd) / Math.abs(lmtd)) * 100;
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-gray-500">—</span>;
  const color = pct >= 0 ? "text-emerald-400" : "text-red-400";
  const arrow = pct >= 0 ? "↑" : "↓";
  return <span className={`font-semibold ${color}`}>{arrow}{Math.abs(pct).toFixed(1)}%</span>;
}

// ─── multi-select pill component ─────────────────────────────────────────────
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    selected.includes(v) ? onChange(selected.filter((x) => x !== v)) : onChange([...selected, v]);
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        {selected.length > 0 && (
          <button onClick={clearAll} className="text-xs text-amber-400 hover:underline">Clear</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${
              selected.includes(o)
                ? "bg-amber-500 border-amber-500 text-black font-semibold"
                : "bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-400"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GROUP BY options ─────────────────────────────────────────────────────────
const GROUP_BY_OPTIONS = [
  { value: "channelGroup", label: "Channel Group" },
  { value: "channelDetail", label: "Channel Detail" },
  { value: "atlBtl", label: "ATL / BTL" },
  { value: "tenure", label: "Tenure" },
  { value: "merchant", label: "Merchant (DD)" },
  { value: "productFamily", label: "Product Family" },
  { value: "productGroup", label: "Product Group" },
  { value: "kpi", label: "KPI Type" },
  { value: "brand", label: "Brand" },
  { value: "areaBranch", label: "Branch" },
  { value: "areaKabkot", label: "Kabupaten" },
] as const;

type GroupByKey = typeof GROUP_BY_OPTIONS[number]["value"];

// ─── months helper ─────────────────────────────────────────────────────────────
function getMonthLabel(ym: string) {
  if (!ym || ym.length < 6) return ym;
  const y = ym.slice(0, 4);
  const m = parseInt(ym.slice(4, 6));
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m-1]} ${y}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductAnalysis() {
  // Brand filter
  const [brands, setBrands] = useState<string[]>([]);
  // Dimension filters
  const [branches, setBranches] = useState<string[]>([]);
  const [kabkots, setKabkots] = useState<string[]>([]);
  const [channelGroups, setChannelGroups] = useState<string[]>([]);
  const [channelDetails, setChannelDetails] = useState<string[]>([]);
  const [atlBtl, setAtlBtl] = useState<string[]>([]);
  const [tenures, setTenures] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [kpis, setKpis] = useState<string[]>([]);
  const [productFamilies, setProductFamilies] = useState<string[]>([]);
  // Group by
  const [groupBy, setGroupBy] = useState<GroupByKey>("channelGroup");

  // Load dimensions
  const { data: dims } = trpc.product.dimensions.useQuery();

  // Determine available year-months from analysis data (we'll use latest 2)
  // We query all data and compute MTD/LMTD on the frontend
  const analysisInput = useMemo(() => ({
    brands: brands.length ? brands : undefined,
    branches: branches.length ? branches : undefined,
    kabkots: kabkots.length ? kabkots : undefined,
    channelGroups: channelGroups.length ? channelGroups : undefined,
    channelDetails: channelDetails.length ? channelDetails : undefined,
    atlBtl: atlBtl.length ? atlBtl : undefined,
    tenures: tenures.length ? tenures : undefined,
    merchants: merchants.length ? merchants : undefined,
    kpis: kpis.length ? kpis : undefined,
    productFamilies: productFamilies.length ? productFamilies : undefined,
    groupBy,
  }), [brands, branches, kabkots, channelGroups, channelDetails, atlBtl, tenures, merchants, kpis, productFamilies, groupBy]);

  const { data: rawRows, isLoading } = trpc.product.analysis.useQuery(analysisInput);

  // Compute MTD / LMTD from the two latest year-months in the data
  const { mtdMonth, lmtdMonth, tableRows, totalMtd, totalLmtd } = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return { mtdMonth: "", lmtdMonth: "", tableRows: [], totalMtd: 0, totalLmtd: 0 };

    const months = Array.from(new Set(rawRows.map(r => r.yearMonth).filter(Boolean))).sort();
    const mtdMonth = months[months.length - 1] || "";
    const lmtdMonth = months[months.length - 2] || "";

    // Aggregate by dimension + brand for MTD and LMTD
    type RowMap = Map<string, { brand: string; mtd: number; lmtd: number }>;
    const dimMap: Map<string, RowMap> = new Map();

    for (const r of rawRows) {
      const dim = r.dimension ?? "(blank)";
      const brand = r.brand ?? "—";
      if (!dimMap.has(dim)) dimMap.set(dim, new Map());
      const brandMap = dimMap.get(dim)!;
      if (!brandMap.has(brand)) brandMap.set(brand, { brand, mtd: 0, lmtd: 0 });
      const entry = brandMap.get(brand)!;
      // Always add to MTD for the latest month; if only one month, all data is MTD
      if (r.yearMonth === mtdMonth) entry.mtd += r.totalRev ?? 0;
      if (lmtdMonth && r.yearMonth === lmtdMonth) entry.lmtd += r.totalRev ?? 0;
    }

    // Build table rows sorted by IOH MTD desc
    const tableRows: Array<{
      dimension: string;
      brands: Array<{ brand: string; mtd: number; lmtd: number }>;
      iohMtd: number;
      iohLmtd: number;
    }> = [];

    for (const [dim, brandMap] of Array.from(dimMap.entries())) {
      const brandRows = Array.from(brandMap.values()).sort((a, b) => b.mtd - a.mtd);
      const iohMtd = brandRows.reduce((s, r) => s + r.mtd, 0);
      const iohLmtd = brandRows.reduce((s, r) => s + r.lmtd, 0);
      tableRows.push({ dimension: dim, brands: brandRows, iohMtd, iohLmtd });
    }

    tableRows.sort((a, b) => b.iohMtd - a.iohMtd);

    const totalMtd = tableRows.reduce((s, r) => s + r.iohMtd, 0);
    const totalLmtd = tableRows.reduce((s, r) => s + r.iohLmtd, 0);

    return { mtdMonth, lmtdMonth, tableRows, totalMtd, totalLmtd };
  }, [rawRows]);

  const showMerchant = channelGroups.includes("DIGITAL DISTRIBUTION") || channelDetails.some(d => d.includes("DD"));

  const activeFilters = [
    ...brands.map(v => ({ label: v, clear: () => setBrands(brands.filter(x => x !== v)) })),
    ...branches.map(v => ({ label: `Branch: ${v}`, clear: () => setBranches(branches.filter(x => x !== v)) })),
    ...kabkots.map(v => ({ label: `Kab: ${v}`, clear: () => setKabkots(kabkots.filter(x => x !== v)) })),
    ...channelGroups.map(v => ({ label: `Ch: ${v}`, clear: () => setChannelGroups(channelGroups.filter(x => x !== v)) })),
    ...kpis.map(v => ({ label: `KPI: ${v}`, clear: () => setKpis(kpis.filter(x => x !== v)) })),
    ...atlBtl.map(v => ({ label: v, clear: () => setAtlBtl(atlBtl.filter(x => x !== v)) })),
    ...tenures.map(v => ({ label: `Tenure: ${v}`, clear: () => setTenures(tenures.filter(x => x !== v)) })),
    ...productFamilies.map(v => ({ label: `Prod: ${v}`, clear: () => setProductFamilies(productFamilies.filter(x => x !== v)) })),
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Product Analysis</h1>
          <p className="text-sm text-gray-400 mt-1">
            MTD vs LMTD variance by product dimension
            {mtdMonth && <> · <span className="text-amber-400">MTD: {getMonthLabel(mtdMonth)}</span></>}
            {lmtdMonth && <> · <span className="text-gray-300">LMTD: {getMonthLabel(lmtdMonth)}</span></>}
          </p>
        </div>

        {/* Brand toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 font-medium">Brand</span>
          {["IOH (Combined)", "IM3", "3ID"].map((b) => {
            const active = b === "IOH (Combined)" ? brands.length === 0 : brands.includes(b);
            return (
              <button
                key={b}
                onClick={() => {
                  if (b === "IOH (Combined)") setBrands([]);
                  else setBrands([b]);
                }}
                className={`px-3 py-1 rounded text-sm font-semibold border transition-colors ${
                  active ? "bg-amber-500 border-amber-500 text-black" : "bg-transparent border-gray-600 text-gray-300 hover:border-amber-400"
                }`}
              >
                {b}
              </button>
            );
          })}
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f, i) => (
              <Badge key={i} variant="secondary" className="bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer" onClick={f.clear}>
                {f.label} ×
              </Badge>
            ))}
            <button className="text-xs text-gray-400 hover:text-white" onClick={() => {
              setBranches([]); setKabkots([]); setChannelGroups([]); setChannelDetails([]);
              setAtlBtl([]); setTenures([]); setMerchants([]); setKpis([]); setProductFamilies([]);
            }}>Clear all</button>
          </div>
        )}

        <div className="flex gap-6">
          {/* ── Left filter panel ── */}
          <div className="w-64 shrink-0 space-y-5 bg-gray-900 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Filters</h3>

            {dims ? (
              <>
                <MultiSelect label="Branch" options={dims.branches} selected={branches} onChange={setBranches} />
                <MultiSelect label="Kabupaten" options={dims.kabkots} selected={kabkots} onChange={setKabkots} />
                <MultiSelect label="Channel Group" options={dims.channelGroups} selected={channelGroups} onChange={setChannelGroups} />
                <MultiSelect label="Channel Detail" options={dims.channelDetails} selected={channelDetails} onChange={setChannelDetails} />
                <MultiSelect label="ATL / BTL" options={dims.atlBtl} selected={atlBtl} onChange={setAtlBtl} />
                <MultiSelect label="Tenure" options={dims.tenures} selected={tenures} onChange={setTenures} />
                <MultiSelect label="KPI Type" options={dims.kpis} selected={kpis} onChange={setKpis} />
                <MultiSelect label="Product Family" options={dims.productFamilies} selected={productFamilies} onChange={setProductFamilies} />
                {(channelGroups.includes("DIGITAL DISTRIBUTION") || channelGroups.length === 0) && (
                  <MultiSelect label="Merchant (DD)" options={dims.merchants} selected={merchants} onChange={setMerchants} />
                )}
              </>
            ) : (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            )}
          </div>

          {/* ── Main content ── */}
          <div className="flex-1 space-y-4">
            {/* Group By selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 font-medium">Group by</span>
              <div className="flex flex-wrap gap-1">
                {GROUP_BY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGroupBy(opt.value)}
                    className={`px-3 py-1 rounded text-sm border transition-colors ${
                      groupBy === opt.value
                        ? "bg-indigo-600 border-indigo-500 text-white font-semibold"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:border-indigo-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary KPI row */}
            {!isLoading && totalMtd > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total MTD", value: fmtRev(totalMtd), sub: null },
                  { label: "Total LMTD", value: fmtRev(totalLmtd), sub: null },
                  { label: "GAP (MTD−LMTD)", value: fmtRev(totalMtd - totalLmtd), sub: null, gap: true },
                  { label: "Growth", value: null, pct: calcGrowth(totalMtd, totalLmtd) },
                ].map((card, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">{card.label}</div>
                    <div className={`text-xl font-bold mt-1 ${card.gap ? (totalMtd >= totalLmtd ? "text-emerald-400" : "text-red-400") : "text-white"}`}>
                      {card.value ?? <GrowthBadge pct={card.pct ?? null} />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Variance table */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">
                  {GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label} — MTD vs LMTD Variance
                </h2>
                <span className="text-xs text-gray-500">{tableRows.length} rows</span>
              </div>

              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : tableRows.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No data for selected filters</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm data-table">
                    <thead>
                      <tr className="text-xs uppercase text-gray-400 border-b border-gray-700">
                        <th className="text-left px-4 py-3">{GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}</th>
                        <th className="text-left px-3 py-3">Brand</th>
                        <th className="text-right px-3 py-3">MTD</th>
                        <th className="text-right px-3 py-3">LMTD</th>
                        <th className="text-right px-3 py-3">GAP</th>
                        <th className="text-right px-3 py-3">Growth %</th>
                        <th className="text-right px-3 py-3">Mix MTD %</th>
                        <th className="text-right px-3 py-3">ANOVA Impact %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, ri) => {
                        const totalGap = totalMtd - totalLmtd;
                        const rowGap = row.iohMtd - row.iohLmtd;
                        const anovaImpact = totalGap !== 0 ? (rowGap / Math.abs(totalGap)) * 100 : null;
                        const mixMtd = totalMtd > 0 ? (row.iohMtd / totalMtd) * 100 : null;

                        // Show brand breakdown if more than one brand
                        const showBrandBreakdown = row.brands.length > 1;

                        return (
                          <>
                            {/* IOH summary row */}
                            <tr key={`${ri}-ioh`} className={`border-b border-gray-800 ${ri % 2 === 0 ? "bg-gray-900" : "bg-gray-850"} hover:bg-gray-800 transition-colors`}>
                              <td className="px-4 py-2.5 font-semibold text-white">{row.dimension}</td>
                              <td className="px-3 py-2.5">
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">IOH</span>
                              </td>
                              <td className="px-3 py-2.5 text-right text-white font-medium">{fmtRev(row.iohMtd)}</td>
                              <td className="px-3 py-2.5 text-right text-gray-300">{fmtRev(row.iohLmtd)}</td>
                              <td className={`px-3 py-2.5 text-right font-semibold ${rowGap >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {rowGap >= 0 ? "+" : ""}{fmtRev(rowGap)}
                              </td>
                              <td className="px-3 py-2.5 text-right"><GrowthBadge pct={calcGrowth(row.iohMtd, row.iohLmtd)} /></td>
                              <td className="px-3 py-2.5 text-right text-amber-300">{mixMtd != null ? mixMtd.toFixed(1) + "%" : "—"}</td>
                              <td className={`px-3 py-2.5 text-right font-semibold ${anovaImpact == null ? "text-gray-500" : anovaImpact >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {anovaImpact != null ? (anovaImpact >= 0 ? "+" : "") + anovaImpact.toFixed(1) + "%" : "—"}
                              </td>
                            </tr>
                            {/* Brand breakdown rows */}
                            {showBrandBreakdown && row.brands.map((br) => {
                              const brGap = br.mtd - br.lmtd;
                              return (
                                <tr key={`${ri}-${br.brand}`} className="border-b border-gray-800/50 bg-gray-800/30 hover:bg-gray-800/60 transition-colors">
                                  <td className="px-4 py-2 pl-8 text-gray-400 text-xs">↳ {row.dimension}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${br.brand === "IM3" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"}`}>
                                      {br.brand}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-300 text-xs">{fmtRev(br.mtd)}</td>
                                  <td className="px-3 py-2 text-right text-gray-400 text-xs">{fmtRev(br.lmtd)}</td>
                                  <td className={`px-3 py-2 text-right text-xs font-medium ${brGap >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {brGap >= 0 ? "+" : ""}{fmtRev(brGap)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-xs"><GrowthBadge pct={calcGrowth(br.mtd, br.lmtd)} /></td>
                                  <td className="px-3 py-2 text-right text-xs text-gray-500">—</td>
                                  <td className="px-3 py-2 text-right text-xs text-gray-500">—</td>
                                </tr>
                              );
                            })}
                          </>
                        );
                      })}
                    </tbody>
                    {/* Total row */}
                    <tfoot>
                      <tr className="border-t-2 border-amber-500/50 bg-gray-800">
                        <td className="px-4 py-3 font-bold text-amber-300" colSpan={2}>TOTAL</td>
                        <td className="px-3 py-3 text-right font-bold text-white">{fmtRev(totalMtd)}</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-300">{fmtRev(totalLmtd)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${totalMtd >= totalLmtd ? "text-emerald-400" : "text-red-400"}`}>
                          {totalMtd >= totalLmtd ? "+" : ""}{fmtRev(totalMtd - totalLmtd)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold"><GrowthBadge pct={calcGrowth(totalMtd, totalLmtd)} /></td>
                        <td className="px-3 py-3 text-right font-bold text-amber-300">100.0%</td>
                        <td className="px-3 py-3 text-right font-bold text-amber-300">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

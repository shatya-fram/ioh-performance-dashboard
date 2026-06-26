import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ─── helpers ──────────────────────────────────────────────────────────────────
// rev column is in raw IDR; 1 Bn IDR = 1,000,000,000
function fmtRev(v: number | null | undefined) {
  if (v == null) return "—";
  const bn = v / 1_000_000_000;
  const abs = Math.abs(bn);
  if (abs >= 1_000) return (bn / 1_000).toFixed(2) + " T Bn";
  if (abs >= 1) return bn.toFixed(2) + " Bn";
  const mn = v / 1_000_000;
  if (Math.abs(mn) >= 1) return mn.toFixed(1) + " Mn";
  return (v / 1_000).toFixed(1) + " K";
}

function calcGrowth(mtd: number, lmtd: number) {
  if (!lmtd) return null;
  return ((mtd - lmtd) / Math.abs(lmtd)) * 100;
}

function GrowthCell({ mtd, lmtd }: { mtd: number; lmtd: number }) {
  const pct = calcGrowth(mtd, lmtd);
  if (pct == null) return <td className="px-3 py-2 text-center text-gray-500">—</td>;
  const color = pct >= 0 ? "text-emerald-400" : "text-red-400";
  const arrow = pct >= 0 ? "▲" : "▼";
  return <td className={`px-3 py-2 text-center font-semibold ${color}`}>{arrow} {Math.abs(pct).toFixed(1)}%</td>;
}

function GapCell({ mtd, lmtd }: { mtd: number; lmtd: number }) {
  const gap = mtd - lmtd;
  const color = gap >= 0 ? "text-emerald-400" : "text-red-400";
  return <td className={`px-3 py-2 text-right font-semibold ${color}`}>{fmtRev(gap)}</td>;
}

function getMonthLabel(ym: string) {
  if (!ym || ym.length < 6) return ym;
  const y = ym.slice(0, 4);
  const m = parseInt(ym.slice(4, 6));
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m-1]} ${y}`;
}

// ─── pill toggle button ────────────────────────────────────────────────────────
function PillToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
        active
          ? "bg-amber-500 border-amber-500 text-black"
          : "bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-400"
      }`}
    >
      {label}
    </button>
  );
}

// ─── multi-select pill row ─────────────────────────────────────────────────────
function FilterRow({
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

  return (
    <div className="flex items-start gap-3">
      <span className="text-sm font-semibold text-gray-400 w-28 shrink-0 pt-1">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <PillToggle key={o} label={o} active={selected.includes(o)} onClick={() => toggle(o)} />
        ))}
        {selected.length > 0 && (
          <button onClick={() => onChange([])} className="px-2 py-1 text-xs text-amber-400 hover:underline">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── reusable variance table (summary tables) ─────────────────────────────────
interface VarRow {
  label: string;
  lastFm: number;
  lmtd: number;
  mtd: number;
}

function VarianceTable({
  title,
  subtitle,
  rows,
  mtdLabel,
  lmtdLabel,
  lastFmLabel,
}: {
  title: string;
  subtitle?: string;
  rows: VarRow[];
  mtdLabel: string;
  lmtdLabel: string;
  lastFmLabel: string;
}) {
  const [sortKey, setSortKey] = useState<"label" | "lastFm" | "lmtd" | "mtd" | "gap" | "growth">("mtd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "label") return sortDir === "asc" ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
      let va = 0, vb = 0;
      if (sortKey === "lastFm") { va = a.lastFm; vb = b.lastFm; }
      else if (sortKey === "lmtd") { va = a.lmtd; vb = b.lmtd; }
      else if (sortKey === "mtd") { va = a.mtd; vb = b.mtd; }
      else if (sortKey === "gap") { va = a.mtd - a.lmtd; vb = b.mtd - b.lmtd; }
      else if (sortKey === "growth") {
        va = a.lmtd ? (a.mtd - a.lmtd) / Math.abs(a.lmtd) : 0;
        vb = b.lmtd ? (b.mtd - b.lmtd) / Math.abs(b.lmtd) : 0;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortTh = ({ k, children }: { k: typeof sortKey; children: React.ReactNode }) => (
    <th
      className="px-3 py-2 text-right cursor-pointer select-none hover:text-amber-400 transition-colors"
      onClick={() => toggleSort(k)}
    >
      {children} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  const totalLastFm = rows.reduce((s, r) => s + r.lastFm, 0);
  const totalLmtd = rows.reduce((s, r) => s + r.lmtd, 0);
  const totalMtd = rows.reduce((s, r) => s + r.mtd, 0);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-400 bg-gray-800/60 border-b border-gray-700">
              <th className="px-3 py-2 text-left cursor-pointer hover:text-amber-400" onClick={() => toggleSort("label")}>
                Dimension {sortKey === "label" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
              <SortTh k="lastFm">Last FM<br /><span className="font-normal normal-case text-gray-500">{lastFmLabel}</span></SortTh>
              <SortTh k="lmtd">LMTD<br /><span className="font-normal normal-case text-gray-500">{lmtdLabel}</span></SortTh>
              <SortTh k="mtd">MTD<br /><span className="font-normal normal-case text-gray-500">{mtdLabel}</span></SortTh>
              <SortTh k="gap">Gap<br /><span className="font-normal normal-case text-gray-500">(MTD−LMTD)</span></SortTh>
              <SortTh k="growth">Growth</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.label} className={`border-b border-gray-800 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"} hover:bg-gray-700/40`}>
                <td className="px-3 py-2 font-medium text-gray-100">{row.label || "(blank)"}</td>
                <td className="px-3 py-2 text-right text-gray-300">{fmtRev(row.lastFm)}</td>
                <td className="px-3 py-2 text-right text-gray-300">{fmtRev(row.lmtd)}</td>
                <td className="px-3 py-2 text-right text-white font-semibold">{fmtRev(row.mtd)}</td>
                <GapCell mtd={row.mtd} lmtd={row.lmtd} />
                <GrowthCell mtd={row.mtd} lmtd={row.lmtd} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800 border-t-2 border-amber-500/50 font-bold text-white">
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-right">{fmtRev(totalLastFm)}</td>
              <td className="px-3 py-2 text-right">{fmtRev(totalLmtd)}</td>
              <td className="px-3 py-2 text-right">{fmtRev(totalMtd)}</td>
              <GapCell mtd={totalMtd} lmtd={totalLmtd} />
              <GrowthCell mtd={totalMtd} lmtd={totalLmtd} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Detail row type (Bottom/Top N) ───────────────────────────────────────────
interface DetailRow {
  productGroup: string;
  channelDetail: string;
  atlBtl: string;
  lastFm: number;
  lmtd: number;
  mtd: number;
}

// ─── Bottom/Top N table with Svc Type + Channel Detail columns ────────────────
function DetailTable({
  title,
  subtitle,
  rows,
  mtdLabel,
  lmtdLabel,
  lastFmLabel,
  highlight,
  topN,
}: {
  title: string;
  subtitle?: string;
  rows: DetailRow[];
  mtdLabel: string;
  lmtdLabel: string;
  lastFmLabel: string;
  highlight: "bottom" | "top";
  topN: number;
}) {
  const defaultSortKey = highlight === "bottom" ? "gap" : "gap";
  const defaultSortDir = highlight === "bottom" ? "asc" : "desc";
  const [sortKey, setSortKey] = useState<"productGroup" | "channelDetail" | "atlBtl" | "lastFm" | "lmtd" | "mtd" | "gap" | "growth">(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "productGroup") return sortDir === "asc" ? a.productGroup.localeCompare(b.productGroup) : b.productGroup.localeCompare(a.productGroup);
      if (sortKey === "channelDetail") return sortDir === "asc" ? a.channelDetail.localeCompare(b.channelDetail) : b.channelDetail.localeCompare(a.channelDetail);
      if (sortKey === "atlBtl") return sortDir === "asc" ? a.atlBtl.localeCompare(b.atlBtl) : b.atlBtl.localeCompare(a.atlBtl);
      let va = 0, vb = 0;
      if (sortKey === "lastFm") { va = a.lastFm; vb = b.lastFm; }
      else if (sortKey === "lmtd") { va = a.lmtd; vb = b.lmtd; }
      else if (sortKey === "mtd") { va = a.mtd; vb = b.mtd; }
      else if (sortKey === "gap") { va = a.mtd - a.lmtd; vb = b.mtd - b.lmtd; }
      else if (sortKey === "growth") {
        va = a.lmtd ? (a.mtd - a.lmtd) / Math.abs(a.lmtd) : 0;
        vb = b.lmtd ? (b.mtd - b.lmtd) / Math.abs(b.lmtd) : 0;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return copy.slice(0, topN);
  }, [rows, sortKey, sortDir, topN]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(highlight === "bottom" ? "asc" : "desc"); }
  };

  const SortTh = ({ k, children, align = "right" }: { k: typeof sortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      className={`px-3 py-2 text-${align} cursor-pointer select-none hover:text-amber-400 transition-colors`}
      onClick={() => toggleSort(k)}
    >
      {children} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  const totalLastFm = sorted.reduce((s, r) => s + r.lastFm, 0);
  const totalLmtd = sorted.reduce((s, r) => s + r.lmtd, 0);
  const totalMtd = sorted.reduce((s, r) => s + r.mtd, 0);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded ${
          highlight === "bottom" ? "bg-red-900/50 text-red-300" : "bg-emerald-900/50 text-emerald-300"
        }`}>
          {highlight === "bottom" ? "⬇ Bottom by Gap" : "⬆ Top by Gain"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-400 bg-gray-800/60 border-b border-gray-700">
              <SortTh k="productGroup" align="left">Product Group</SortTh>
              <SortTh k="channelDetail" align="left">Channel Detail</SortTh>
              <SortTh k="atlBtl" align="left">Svc Type</SortTh>
              <SortTh k="lastFm">Last FM<br /><span className="font-normal normal-case text-gray-500">{lastFmLabel}</span></SortTh>
              <SortTh k="lmtd">LMTD<br /><span className="font-normal normal-case text-gray-500">{lmtdLabel}</span></SortTh>
              <SortTh k="mtd">MTD<br /><span className="font-normal normal-case text-gray-500">{mtdLabel}</span></SortTh>
              <SortTh k="gap">Gap<br /><span className="font-normal normal-case text-gray-500">(MTD−LMTD)</span></SortTh>
              <SortTh k="growth">Growth</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const gap = row.mtd - row.lmtd;
              const isNegative = gap < 0;
              return (
                <tr
                  key={`${row.productGroup}|${row.channelDetail}|${row.atlBtl}`}
                  className={`border-b border-gray-800 ${
                    highlight === "bottom" && isNegative && Math.abs(gap) > 500_000_000
                      ? "bg-red-950/30"
                      : i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/30"
                  } hover:bg-gray-700/40`}
                >
                  <td className="px-3 py-2 font-medium text-gray-100 max-w-[220px] truncate" title={row.productGroup}>
                    {row.productGroup || "(blank)"}
                  </td>
                  <td className="px-3 py-2 text-gray-300 max-w-[160px] truncate" title={row.channelDetail}>
                    {row.channelDetail || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      row.atlBtl === "ATL"
                        ? "bg-blue-900/60 text-blue-300"
                        : row.atlBtl === "BTL"
                        ? "bg-purple-900/60 text-purple-300"
                        : "bg-gray-700 text-gray-400"
                    }`}>
                      {row.atlBtl || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtRev(row.lastFm)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtRev(row.lmtd)}</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{fmtRev(row.mtd)}</td>
                  <GapCell mtd={row.mtd} lmtd={row.lmtd} />
                  <GrowthCell mtd={row.mtd} lmtd={row.lmtd} />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800 border-t-2 border-amber-500/50 font-bold text-white">
              <td className="px-3 py-2" colSpan={3}>TOTAL (shown rows)</td>
              <td className="px-3 py-2 text-right">{fmtRev(totalLastFm)}</td>
              <td className="px-3 py-2 text-right">{fmtRev(totalLmtd)}</td>
              <td className="px-3 py-2 text-right">{fmtRev(totalMtd)}</td>
              <GapCell mtd={totalMtd} lmtd={totalLmtd} />
              <GrowthCell mtd={totalMtd} lmtd={totalLmtd} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProductAnalysis() {
  // Filters (matching Excel template)
  const [brands, setBrands] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [atlBtl, setAtlBtl] = useState<string[]>([]);
  const [tenures, setTenures] = useState<string[]>([]);
  // Secondary filters
  const [channelGroups, setChannelGroups] = useState<string[]>([]);
  const [channelDetails, setChannelDetails] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [kpis, setKpis] = useState<string[]>([]);
  const [productFamilies, setProductFamilies] = useState<string[]>([]);
  const [showMerchantFilter, setShowMerchantFilter] = useState(false);
  const [topN, setTopN] = useState(20);

  // Load dimensions
  const { data: dims } = trpc.product.dimensions.useQuery();

  // Base filter input (memoized to avoid infinite re-fetch)
  const baseInput = useMemo(() => ({
    brands: brands.length ? brands : undefined,
    branches: branches.length ? branches : undefined,
    atlBtl: atlBtl.length ? atlBtl : undefined,
    tenures: tenures.length ? tenures : undefined,
    channelGroups: channelGroups.length ? channelGroups : undefined,
    channelDetails: channelDetails.length ? channelDetails : undefined,
    merchants: merchants.length ? merchants : undefined,
    kpis: kpis.length ? kpis : undefined,
    productFamilies: productFamilies.length ? productFamilies : undefined,
  }), [brands, branches, atlBtl, tenures, channelGroups, channelDetails, merchants, kpis, productFamilies]);

  // Summary queries (groupBy single dimension)
  const { data: byBranch, isLoading: loadBranch } = trpc.product.analysis.useQuery({ ...baseInput, groupBy: "areaBranch" });
  const { data: byChannel, isLoading: loadChannel } = trpc.product.analysis.useQuery({ ...baseInput, groupBy: "channelGroup" });
  const { data: byTenure, isLoading: loadTenure } = trpc.product.analysis.useQuery({ ...baseInput, groupBy: "tenure" });

  // Detail query for Bottom/Top N (productGroup + channelDetail + atlBtl)
  const { data: detailRaw, isLoading: loadDetail } = trpc.product.detail.useQuery(baseInput);

  const isLoading = loadBranch || loadChannel || loadTenure || loadDetail;

  // Helper: pivot raw rows into VarRow[]
  function pivotRows(raw: typeof byBranch): { rows: VarRow[]; mtdMonth: string; lmtdMonth: string; lastFmMonth: string } {
    if (!raw || raw.length === 0) return { rows: [], mtdMonth: "", lmtdMonth: "", lastFmMonth: "" };
    const months = Array.from(new Set(raw.map(r => r.yearMonth).filter(Boolean))).sort() as string[];
    const mtdMonth = months[months.length - 1] || "";
    const lmtdMonth = months[months.length - 2] || "";
    const lastFmMonth = months[months.length - 3] || lmtdMonth;

    const dimMap = new Map<string, { mtd: number; lmtd: number; lastFm: number }>();
    for (const r of raw) {
      const dim = r.dimension ?? "(blank)";
      if (!dimMap.has(dim)) dimMap.set(dim, { mtd: 0, lmtd: 0, lastFm: 0 });
      const e = dimMap.get(dim)!;
      if (r.yearMonth === mtdMonth) e.mtd += r.totalRev ?? 0;
      if (lmtdMonth && r.yearMonth === lmtdMonth) e.lmtd += r.totalRev ?? 0;
      if (lastFmMonth && r.yearMonth === lastFmMonth) e.lastFm += r.totalRev ?? 0;
    }
    const rows: VarRow[] = Array.from(dimMap.entries()).map(([label, v]) => ({ label, ...v }));
    return { rows, mtdMonth, lmtdMonth, lastFmMonth };
  }

  // Helper: pivot detail rows into DetailRow[]
  function pivotDetailRows(raw: typeof detailRaw): { rows: DetailRow[]; mtdMonth: string; lmtdMonth: string; lastFmMonth: string } {
    if (!raw || raw.length === 0) return { rows: [], mtdMonth: "", lmtdMonth: "", lastFmMonth: "" };
    const months = Array.from(new Set(raw.map(r => r.yearMonth).filter(Boolean))).sort() as string[];
    const mtdMonth = months[months.length - 1] || "";
    const lmtdMonth = months[months.length - 2] || "";
    const lastFmMonth = months[months.length - 3] || lmtdMonth;

    // Key: productGroup|channelDetail|atlBtl (aggregated across brands)
    const dimMap = new Map<string, { productGroup: string; channelDetail: string; atlBtl: string; mtd: number; lmtd: number; lastFm: number }>();
    for (const r of raw) {
      const key = `${r.productGroup ?? ""}|${r.channelDetail ?? ""}|${r.atlBtl ?? ""}`;
      if (!dimMap.has(key)) dimMap.set(key, {
        productGroup: r.productGroup ?? "",
        channelDetail: r.channelDetail ?? "",
        atlBtl: r.atlBtl ?? "",
        mtd: 0, lmtd: 0, lastFm: 0,
      });
      const e = dimMap.get(key)!;
      if (r.yearMonth === mtdMonth) e.mtd += r.totalRev ?? 0;
      if (lmtdMonth && r.yearMonth === lmtdMonth) e.lmtd += r.totalRev ?? 0;
      if (lastFmMonth && r.yearMonth === lastFmMonth) e.lastFm += r.totalRev ?? 0;
    }
    const rows: DetailRow[] = Array.from(dimMap.values());
    return { rows, mtdMonth, lmtdMonth, lastFmMonth };
  }

  const branchData = useMemo(() => pivotRows(byBranch), [byBranch]);
  const channelData = useMemo(() => pivotRows(byChannel), [byChannel]);
  const tenureData = useMemo(() => pivotRows(byTenure), [byTenure]);
  const detailData = useMemo(() => pivotDetailRows(detailRaw), [detailRaw]);

  // Bottom N: sorted by gap ascending (most negative first)
  const bottomN = useMemo(() =>
    [...detailData.rows].sort((a, b) => (a.mtd - a.lmtd) - (b.mtd - b.lmtd))
  , [detailData.rows]);

  // Top N: sorted by gap descending (most positive first)
  const topN_rows = useMemo(() =>
    [...detailData.rows].sort((a, b) => (b.mtd - b.lmtd) - (a.mtd - a.lmtd))
  , [detailData.rows]);

  const mtdLabel = branchData.mtdMonth ? getMonthLabel(branchData.mtdMonth) : "MTD";
  const lmtdLabel = branchData.lmtdMonth ? getMonthLabel(branchData.lmtdMonth) : "LMTD";
  const lastFmLabel = branchData.lastFmMonth ? getMonthLabel(branchData.lastFmMonth) : "Last FM";

  const showDD = channelGroups.includes("DIGITAL DISTRIBUTION") || channelDetails.some(d => d.toLowerCase().includes("dd"));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="border-l-4 border-amber-500 pl-4">
          <h1 className="text-xl font-bold text-white">Product Analysis</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            MTD vs LMTD variance by product, channel, branch and tenure
            {mtdLabel && <> · <span className="text-amber-400">MTD: {mtdLabel}</span> · <span className="text-gray-300">LMTD: {lmtdLabel}</span> · <span className="text-gray-300">Last FM: {lastFmLabel}</span></>}
          </p>
        </div>

        {/* ── FILTER PANEL ── */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-500">FILTER</span>
          </div>

          {/* Primary filters */}
          <FilterRow label="BRANCH" options={dims?.branches ?? []} selected={branches} onChange={setBranches} />
          <FilterRow label="BRAND" options={["IM3", "3ID"]} selected={brands} onChange={setBrands} />
          <FilterRow label="ATL / BTL" options={dims?.atlBtl ?? []} selected={atlBtl} onChange={setAtlBtl} />
          <FilterRow label="TENURE SLABS" options={dims?.tenures ?? []} selected={tenures} onChange={setTenures} />

          {/* Divider + secondary filters */}
          <div className="border-t border-gray-700 pt-3 space-y-3">
            <FilterRow label="CHANNEL GROUP" options={dims?.channelGroups ?? []} selected={channelGroups} onChange={setChannelGroups} />
            <FilterRow label="CHANNEL DETAIL" options={dims?.channelDetails ?? []} selected={channelDetails} onChange={setChannelDetails} />
            {(showDD || showMerchantFilter) && (
              <FilterRow label="MERCHANT (DD)" options={dims?.merchants ?? []} selected={merchants} onChange={setMerchants} />
            )}
            <FilterRow label="KPI TYPE" options={dims?.kpis ?? []} selected={kpis} onChange={setKpis} />
            <FilterRow label="PRODUCT" options={dims?.productFamilies ?? []} selected={productFamilies} onChange={setProductFamilies} />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-6 pt-2 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <Switch id="merchant-toggle" checked={showMerchantFilter} onCheckedChange={setShowMerchantFilter} />
              <Label htmlFor="merchant-toggle" className="text-sm text-gray-300">Show Merchant Filter</Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Top / Bottom N:</span>
              {[10, 20, 30, 50].map(n => (
                <PillToggle key={n} label={String(n)} active={topN === n} onClick={() => setTopN(n)} />
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            {/* ── TABLE 1: Summary by Branch / Channel / Tenure ── */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-amber-400 uppercase tracking-wide">
                Summary View — Selections: Contributions
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <VarianceTable title="By Branch" rows={branchData.rows} mtdLabel={mtdLabel} lmtdLabel={lmtdLabel} lastFmLabel={lastFmLabel} />
                <VarianceTable title="By Channel" rows={channelData.rows} mtdLabel={mtdLabel} lmtdLabel={lmtdLabel} lastFmLabel={lastFmLabel} />
                <VarianceTable title="By Tenure" rows={tenureData.rows} mtdLabel={mtdLabel} lmtdLabel={lmtdLabel} lastFmLabel={lastFmLabel} />
              </div>
            </div>

            {/* ── TABLE 2: Bottom N Products Lost ── */}
            <div className="space-y-2">
              <h2 className="text-base font-bold text-red-400 uppercase tracking-wide">
                Selections Bottom {topN} Product Lost — Short by Highest Gap
              </h2>
              <DetailTable
                title={`Bottom ${topN} Products by Revenue Gap (MTD vs LMTD)`}
                subtitle="Product Group · Channel Detail · Svc Type (ATL/BTL) — sorted by largest negative gap"
                rows={bottomN}
                mtdLabel={mtdLabel}
                lmtdLabel={lmtdLabel}
                lastFmLabel={lastFmLabel}
                highlight="bottom"
                topN={topN}
              />
            </div>

            {/* ── TABLE 3: Top N Products Gain ── */}
            <div className="space-y-2">
              <h2 className="text-base font-bold text-emerald-400 uppercase tracking-wide">
                Selections Top {topN} Product Gain — Highest Growth
              </h2>
              <DetailTable
                title={`Top ${topN} Products by Revenue Gain (MTD vs LMTD)`}
                subtitle="Product Group · Channel Detail · Svc Type (ATL/BTL) — sorted by largest positive gap"
                rows={topN_rows}
                mtdLabel={mtdLabel}
                lmtdLabel={lmtdLabel}
                lastFmLabel={lastFmLabel}
                highlight="top"
                topN={topN}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

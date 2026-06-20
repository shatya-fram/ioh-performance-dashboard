import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useFilter } from "@/contexts/FilterContext";
import { GlobalFilterBar } from "@/components/GlobalFilterBar";
import { formatNumber, BRAND_COLORS } from "@/lib/kpiUtils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtRev(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} Bn`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} Mn`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)} K`;
  return `${sign}${abs.toFixed(0)}`;
}

function fmtGap(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return sign + fmtRev(v);
}

function fmtGrowth(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function growthClass(v: number): string {
  if (v > 0) return "value-positive";
  if (v < 0) return "value-negative";
  return "text-muted-foreground";
}

function GrowthIcon({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="inline w-3 h-3 mr-0.5" />;
  if (v < 0) return <TrendingDown className="inline w-3 h-3 mr-0.5" />;
  return <Minus className="inline w-3 h-3 mr-0.5" />;
}

// ─── Row definition ───────────────────────────────────────────────────────────
interface RevRow {
  label: string;
  sublabel?: string;
  indent?: boolean;
  isBold?: boolean;
  isSeparator?: boolean;
  mtd: number;
  lmtd: number;
  lastFm: number;
  gap: number;
  growth: number;
  isVoucherRow?: boolean;
}

// ─── Summary Box ──────────────────────────────────────────────────────────────
function SummaryBox({
  label,
  sublabel,
  mtd,
  lmtd,
  gap,
  growth,
  accentColor,
}: {
  label: string;
  sublabel?: string;
  mtd: number;
  lmtd: number;
  gap: number;
  growth: number;
  accentColor?: string;
}) {
  return (
    <div
      className="kpi-card flex flex-col gap-2"
      style={{ borderLeft: `3px solid ${accentColor ?? "oklch(0.78 0.16 75)"}` }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground/70">{sublabel}</p>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">MTD</p>
          <p className="text-lg font-bold text-foreground">{fmtRev(mtd)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground mb-0.5">LMTD</p>
          <p className="text-sm font-medium text-foreground/80">{fmtRev(lmtd)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <span className={`text-sm font-semibold ${growthClass(gap)}`}>
          <GrowthIcon v={gap} />
          {fmtGap(gap)} IDR
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${growth >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
          {fmtGrowth(growth)}
        </span>
      </div>
    </div>
  );
}

// ─── Performance Table ────────────────────────────────────────────────────────
function PerformanceTable({ rows, title }: { rows: RevRow[]; title: string }) {
  return (
    <div className="chart-container overflow-x-auto">
      <div className="section-header mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <table className="w-full text-xs data-table min-w-[700px]">
        <thead>
          <tr>
            <th className="text-left py-2.5 px-4 rounded-l-md w-[220px]">Revenue Component</th>
            <th className="text-right py-2.5 px-4">MTD (Bn IDR)</th>
            <th className="text-right py-2.5 px-4">LMTD (Bn IDR)</th>
            <th className="text-right py-2.5 px-4">Last FM (Bn IDR)</th>
            <th className="text-right py-2.5 px-4">GAP (MTD−LMTD)</th>
            <th className="text-right py-2.5 px-4 rounded-r-md">Growth %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.isSeparator) {
              return (
                <tr key={i}>
                  <td colSpan={6} className="py-1 px-4">
                    <div className="border-t border-border/20" />
                  </td>
                </tr>
              );
            }
            return (
              <tr
                key={i}
                className={`border-t border-border/20 hover:bg-accent/10 transition-colors ${
                  row.isBold ? "bg-accent/5" : ""
                } ${row.isVoucherRow ? "opacity-80" : ""}`}
              >
                <td className={`py-2.5 px-4 ${row.indent ? "pl-8" : ""}`}>
                  <span className={row.isBold ? "font-semibold text-foreground" : "text-foreground/85"}>
                    {row.label}
                  </span>
                  {row.sublabel && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{row.sublabel}</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right font-medium">
                  {formatNumber(row.mtd / 1e9, 2)}
                </td>
                <td className="py-2.5 px-4 text-right text-muted-foreground">
                  {formatNumber(row.lmtd / 1e9, 2)}
                </td>
                <td className="py-2.5 px-4 text-right text-muted-foreground">
                  {formatNumber(row.lastFm / 1e9, 2)}
                </td>
                <td className={`py-2.5 px-4 text-right font-semibold ${growthClass(row.gap)}`}>
                  {fmtGap(row.gap / 1e9)}
                </td>
                <td className={`py-2.5 px-4 text-right ${growthClass(row.growth)}`}>
                  <GrowthIcon v={row.growth} />
                  {fmtGrowth(row.growth)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Brand Performance Table (side-by-side IM3 / 3ID / IOH) ──────────────────
interface BrandMetrics {
  mtd: number;
  lmtd: number;
  lastFm: number;
}

function BrandPerformanceTable({
  im3,
  sid,
  ioh,
  normalizeVoucher,
  voucherIm3,
  voucher3id,
}: {
  im3: Record<string, BrandMetrics>;
  sid: Record<string, BrandMetrics>;
  ioh: Record<string, BrandMetrics>;
  normalizeVoucher: boolean;
  voucherIm3: number;
  voucher3id: number;
}) {
  const rows: Array<{ label: string; field: string; indent?: boolean; isBold?: boolean; isVoucher?: boolean }> = [
    { label: "Total Revenue", field: "revPrepaid", isBold: true },
    { label: "Base Revenue", field: "revBase", indent: true },
    { label: "Acquisition Revenue", field: "revAcqM0", indent: true },
    { label: "─ Organic Channel", field: "revOrganic", indent: true },
    { label: "─ Trade Channel", field: "revTrade", indent: true },
    { label: "─ Non-Trade Channel", field: "revNonTrade", indent: true },
    { label: "Voucher Game Effect", field: "voucher", isVoucher: true },
  ];

  const voucherEffect = { im3: voucherIm3, "3id": voucher3id, ioh: voucherIm3 + voucher3id };

  function getVal(brand: "im3" | "3id" | "ioh", field: string, period: "mtd" | "lmtd" | "lastFm"): number {
    const map = brand === "im3" ? im3 : brand === "3id" ? sid : ioh;
    if (field === "voucher") {
      return voucherEffect[brand];
    }
    return map[field]?.[period] ?? 0;
  }

  function getAdjustedVal(brand: "im3" | "3id" | "ioh", field: string, period: "mtd" | "lmtd" | "lastFm"): number {
    const raw = getVal(brand, field, period);
    if (normalizeVoucher && field === "revPrepaid") {
      return raw - (period === "mtd" ? voucherEffect[brand] : 0);
    }
    return raw;
  }

  const brandCols: Array<{ key: "im3" | "3id" | "ioh"; label: string; color: string }> = [
    { key: "im3", label: "IM3", color: BRAND_COLORS["IM3"] },
    { key: "3id", label: "3ID", color: BRAND_COLORS["3ID"] },
    { key: "ioh", label: "IOH", color: BRAND_COLORS["IOH"] },
  ];

  return (
    <div className="chart-container overflow-x-auto">
      <div className="section-header mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Revenue Performance by Brand
          {normalizeVoucher && (
            <span className="ml-2 text-xs font-normal text-amber-400">(Voucher Game Normalized)</span>
          )}
        </h3>
      </div>
      <table className="w-full text-xs data-table min-w-[900px]">
        <thead>
          <tr>
            <th className="text-left py-2.5 px-4 rounded-l-md w-[200px]">Revenue Component</th>
            {brandCols.map((b) => (
              <>
                <th
                  key={`${b.key}-mtd`}
                  className="text-right py-2.5 px-3"
                  style={{ color: b.color }}
                >
                  {b.label} MTD
                </th>
                <th key={`${b.key}-lmtd`} className="text-right py-2.5 px-3 text-muted-foreground">
                  {b.label} LMTD
                </th>
                <th
                  key={`${b.key}-gap`}
                  className="text-right py-2.5 px-3 rounded-r-md"
                  style={{ color: b.color }}
                >
                  {b.label} GAP
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-border/20 hover:bg-accent/10 transition-colors ${
                row.isBold ? "bg-accent/5" : ""
              } ${row.isVoucher ? "opacity-75" : ""}`}
            >
              <td className={`py-2.5 px-4 ${row.indent ? "pl-7" : ""}`}>
                <span className={row.isBold ? "font-semibold text-foreground" : "text-foreground/85"}>
                  {row.label}
                </span>
              </td>
              {brandCols.map((b) => {
                const mtdVal = getAdjustedVal(b.key, row.field, "mtd");
                const lmtdVal = getAdjustedVal(b.key, row.field, "lmtd");
                const gap = mtdVal - lmtdVal;
                const growth = lmtdVal !== 0 ? (gap / Math.abs(lmtdVal)) * 100 : 0;
                return (
                  <>
                    <td key={`${b.key}-mtd`} className="py-2.5 px-3 text-right font-medium">
                      {row.isVoucher ? fmtRev(mtdVal) : formatNumber(mtdVal / 1e9, 2)}
                    </td>
                    <td key={`${b.key}-lmtd`} className="py-2.5 px-3 text-right text-muted-foreground">
                      {row.isVoucher ? fmtRev(lmtdVal) : formatNumber(lmtdVal / 1e9, 2)}
                    </td>
                    <td
                      key={`${b.key}-gap`}
                      className={`py-2.5 px-3 text-right font-semibold ${growthClass(gap)}`}
                    >
                      {row.isVoucher
                        ? fmtGap(gap)
                        : `${gap >= 0 ? "+" : ""}${formatNumber(gap / 1e9, 2)}`}
                      <span className={`ml-1 text-[10px] font-normal ${growthClass(growth)}`}>
                        ({fmtGrowth(growth)})
                      </span>
                    </td>
                  </>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ANOVAAnalysis() {
  const { filter, brandsArray, areasArray, salesAreasArray, kabkotsArray, setNormalizeVoucher } = useFilter();

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

  // ─── Period resolution ────────────────────────────────────────────────────
  const { mtdMonths, latestMtd, prevMtd } = useMemo(() => {
    if (!mtdQuery.data) return { mtdMonths: [], latestMtd: "", prevMtd: "" };
    const months = Array.from(new Set(mtdQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    return {
      mtdMonths: months,
      latestMtd: months[months.length - 1] ?? "",
      prevMtd: months[months.length - 2] ?? "",
    };
  }, [mtdQuery.data]);

  const { fmMonths, latestFm } = useMemo(() => {
    if (!fmQuery.data) return { fmMonths: [], latestFm: "" };
    const months = Array.from(new Set(fmQuery.data.map((r) => String(r.yearMonth ?? "")))).sort();
    return { fmMonths: months, latestFm: months[months.length - 1] ?? "" };
  }, [fmQuery.data]);

  // ─── Aggregate helpers ────────────────────────────────────────────────────
  type RevFields = {
    revPrepaid: number;
    revBase: number;
    revAcqM0: number;
    revOrganic: number;
    revTrade: number;
    revNonTrade: number;
  };

  const ZERO_FIELDS: RevFields = {
    revPrepaid: 0, revBase: 0, revAcqM0: 0,
    revOrganic: 0, revTrade: 0, revNonTrade: 0,
  };

  function sumRows(data: any[], yearMonthFilter: string): RevFields {
    const acc = { ...ZERO_FIELDS };
    for (const row of data) {
      if (String(row.yearMonth ?? "") !== yearMonthFilter) continue;
      acc.revPrepaid += Number(row.revPrepaid) || 0;
      acc.revBase += Number(row.revBase) || 0;
      acc.revAcqM0 += Number(row.revAcqM0) || 0;
      acc.revOrganic += Number(row.revOrganic) || 0;
      acc.revTrade += Number(row.revTrade) || 0;
      acc.revNonTrade += Number(row.revNonTrade) || 0;
    }
    return acc;
  }

  function sumRowsByBrand(data: any[], yearMonthFilter: string, brand: string): RevFields {
    const acc = { ...ZERO_FIELDS };
    for (const row of data) {
      if (String(row.yearMonth ?? "") !== yearMonthFilter) continue;
      if (String(row.brand ?? "") !== brand) continue;
      acc.revPrepaid += Number(row.revPrepaid) || 0;
      acc.revBase += Number(row.revBase) || 0;
      acc.revAcqM0 += Number(row.revAcqM0) || 0;
      acc.revOrganic += Number(row.revOrganic) || 0;
      acc.revTrade += Number(row.revTrade) || 0;
      acc.revNonTrade += Number(row.revNonTrade) || 0;
    }
    return acc;
  }

  // ─── IOH (combined) aggregates ────────────────────────────────────────────
  const iohMtd = useMemo(() => sumRows(mtdQuery.data ?? [], latestMtd), [mtdQuery.data, latestMtd]);
  const iohLmtd = useMemo(() => sumRows(mtdQuery.data ?? [], prevMtd), [mtdQuery.data, prevMtd]);
  const iohFm = useMemo(() => sumRows(fmQuery.data ?? [], latestFm), [fmQuery.data, latestFm]);

  // ─── Per-brand aggregates ─────────────────────────────────────────────────
  const im3Mtd = useMemo(() => sumRowsByBrand(mtdQuery.data ?? [], latestMtd, "IM3"), [mtdQuery.data, latestMtd]);
  const im3Lmtd = useMemo(() => sumRowsByBrand(mtdQuery.data ?? [], prevMtd, "IM3"), [mtdQuery.data, prevMtd]);
  const im3Fm = useMemo(() => sumRowsByBrand(fmQuery.data ?? [], latestFm, "IM3"), [fmQuery.data, latestFm]);

  const sid3Mtd = useMemo(() => sumRowsByBrand(mtdQuery.data ?? [], latestMtd, "3ID"), [mtdQuery.data, latestMtd]);
  const sid3Lmtd = useMemo(() => sumRowsByBrand(mtdQuery.data ?? [], prevMtd, "3ID"), [mtdQuery.data, prevMtd]);
  const sid3Fm = useMemo(() => sumRowsByBrand(fmQuery.data ?? [], latestFm, "3ID"), [fmQuery.data, latestFm]);

  // ─── Voucher game effect ──────────────────────────────────────────────────
  const { voucherIm3, voucher3id, voucherTotal } = useMemo(() => {
    const rows = (voucherQuery.data ?? []) as any[];
    const latestVoucher = rows.length
      ? Array.from(new Set(rows.map((r) => String(r.yearMonth ?? "")))).sort().at(-1)
      : "";
    const filtered = rows.filter((r) => String(r.yearMonth ?? "") === latestVoucher);
    const im3 = filtered
      .filter((r) => String(r.brand ?? "").toUpperCase() === "IM3")
      .reduce((s, r) => s + (Number(r.totalEffect) || 0), 0);
    const sid = filtered
      .filter((r) => String(r.brand ?? "").toUpperCase() === "3ID")
      .reduce((s, r) => s + (Number(r.totalEffect) || 0), 0);
    return { voucherIm3: im3, voucher3id: sid, voucherTotal: im3 + sid };
  }, [voucherQuery.data]);

  const normalizeVoucher = filter.normalizeVoucher;

  // ─── Build IOH performance rows ───────────────────────────────────────────
  const iohRows = useMemo((): RevRow[] => {
    const fields: Array<{ label: string; field: keyof RevFields; indent?: boolean; isBold?: boolean }> = [
      { label: "Total Revenue", field: "revPrepaid", isBold: true },
      { label: "Base Revenue", field: "revBase", indent: true },
      { label: "Acquisition Revenue", field: "revAcqM0", indent: true },
      { label: "Organic Channel Revenue", field: "revOrganic", indent: true },
      { label: "Trade Channel Revenue", field: "revTrade", indent: true },
      { label: "Non-Trade Channel Revenue", field: "revNonTrade", indent: true },
    ];

    const rows: RevRow[] = fields.map(({ label, field, indent, isBold }) => {
      let mtd = iohMtd[field];
      let lmtd = iohLmtd[field];
      const lastFm = iohFm[field];
      if (normalizeVoucher && field === "revPrepaid") {
        mtd = mtd - voucherTotal;
      }
      const gap = mtd - lmtd;
      const growth = lmtd !== 0 ? (gap / Math.abs(lmtd)) * 100 : 0;
      return { label, indent, isBold, mtd, lmtd, lastFm, gap, growth };
    });

    // Voucher Game Effect row
    rows.push({
      label: "Voucher Game Effect",
      sublabel: "(excl. from Total when normalized)",
      isVoucherRow: true,
      mtd: voucherTotal,
      lmtd: 0,
      lastFm: 0,
      gap: voucherTotal,
      growth: 0,
    });

    return rows;
  }, [iohMtd, iohLmtd, iohFm, voucherTotal, normalizeVoucher]);

  // ─── Build per-brand metric maps ──────────────────────────────────────────
  const im3Map = useMemo((): Record<string, BrandMetrics> => {
    const fields = ["revPrepaid", "revBase", "revAcqM0", "revOrganic", "revTrade", "revNonTrade"] as const;
    const map: Record<string, BrandMetrics> = {};
    for (const f of fields) {
      map[f] = { mtd: im3Mtd[f], lmtd: im3Lmtd[f], lastFm: im3Fm[f] };
    }
    return map;
  }, [im3Mtd, im3Lmtd, im3Fm]);

  const sid3Map = useMemo((): Record<string, BrandMetrics> => {
    const fields = ["revPrepaid", "revBase", "revAcqM0", "revOrganic", "revTrade", "revNonTrade"] as const;
    const map: Record<string, BrandMetrics> = {};
    for (const f of fields) {
      map[f] = { mtd: sid3Mtd[f], lmtd: sid3Lmtd[f], lastFm: sid3Fm[f] };
    }
    return map;
  }, [sid3Mtd, sid3Lmtd, sid3Fm]);

  const iohMap = useMemo((): Record<string, BrandMetrics> => {
    const fields = ["revPrepaid", "revBase", "revAcqM0", "revOrganic", "revTrade", "revNonTrade"] as const;
    const map: Record<string, BrandMetrics> = {};
    for (const f of fields) {
      map[f] = { mtd: iohMtd[f], lmtd: iohLmtd[f], lastFm: iohFm[f] };
    }
    return map;
  }, [iohMtd, iohLmtd, iohFm]);

  const isLoading = fmQuery.isLoading || mtdQuery.isLoading;

  // ─── Summary box data ─────────────────────────────────────────────────────
  const totalMtd = normalizeVoucher ? iohMtd.revPrepaid - voucherTotal : iohMtd.revPrepaid;
  const totalLmtd = iohLmtd.revPrepaid;
  const totalGap = totalMtd - totalLmtd;
  const totalGrowth = totalLmtd !== 0 ? (totalGap / Math.abs(totalLmtd)) * 100 : 0;

  const baseGap = iohMtd.revBase - iohLmtd.revBase;
  const baseGrowth = iohLmtd.revBase !== 0 ? (baseGap / Math.abs(iohLmtd.revBase)) * 100 : 0;

  const acqGap = iohMtd.revAcqM0 - iohLmtd.revAcqM0;
  const acqGrowth = iohLmtd.revAcqM0 !== 0 ? (acqGap / Math.abs(iohLmtd.revAcqM0)) * 100 : 0;

  const orgGap = iohMtd.revOrganic - iohLmtd.revOrganic;
  const orgGrowth = iohLmtd.revOrganic !== 0 ? (orgGap / Math.abs(iohLmtd.revOrganic)) * 100 : 0;

  const tradeGap = iohMtd.revTrade - iohLmtd.revTrade;
  const tradeGrowth = iohLmtd.revTrade !== 0 ? (tradeGap / Math.abs(iohLmtd.revTrade)) * 100 : 0;

  const ntGap = iohMtd.revNonTrade - iohLmtd.revNonTrade;
  const ntGrowth = iohLmtd.revNonTrade !== 0 ? (ntGap / Math.abs(iohLmtd.revNonTrade)) * 100 : 0;

  // ─── Period label helpers ─────────────────────────────────────────────────
  function periodLabel(ym: string): string {
    if (!ym) return "—";
    const y = ym.slice(0, 4);
    const m = parseInt(ym.slice(4, 6), 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[m - 1] ?? m} ${y}`;
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="section-header mb-0">
          <div>
            <h1 className="text-xl font-bold text-foreground">Revenue Gap Analysis</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              MTD vs LMTD variance by revenue stream and channel
              {latestMtd && (
                <span className="ml-2 text-xs text-amber-400/80">
                  · MTD: {periodLabel(latestMtd)} · LMTD: {periodLabel(prevMtd)} · Last FM: {periodLabel(latestFm)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            id="normalize"
            checked={filter.normalizeVoucher}
            onCheckedChange={(v) => setNormalizeVoucher(v)}
          />
          <Label htmlFor="normalize" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            Normalize (excl. Voucher Game)
          </Label>
        </div>
      </div>

      <GlobalFilterBar />

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="kpi-card h-28 skeleton" />
            ))}
          </div>
          <div className="chart-container h-64 skeleton" />
        </div>
      )}

      {/* ── Summary boxes ───────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryBox
            label="Total Revenue"
            sublabel={normalizeVoucher ? "excl. Voucher Game" : undefined}
            mtd={totalMtd}
            lmtd={totalLmtd}
            gap={totalGap}
            growth={totalGrowth}
            accentColor={BRAND_COLORS["IOH"]}
          />
          <SummaryBox
            label="Base Revenue"
            mtd={iohMtd.revBase}
            lmtd={iohLmtd.revBase}
            gap={baseGap}
            growth={baseGrowth}
            accentColor="oklch(0.65 0.18 220)"
          />
          <SummaryBox
            label="Acquisition Revenue"
            mtd={iohMtd.revAcqM0}
            lmtd={iohLmtd.revAcqM0}
            gap={acqGap}
            growth={acqGrowth}
            accentColor="oklch(0.78 0.16 75)"
          />
          <SummaryBox
            label="Organic Channel"
            mtd={iohMtd.revOrganic}
            lmtd={iohLmtd.revOrganic}
            gap={orgGap}
            growth={orgGrowth}
            accentColor="oklch(0.72 0.18 160)"
          />
          <SummaryBox
            label="Trade Channel"
            mtd={iohMtd.revTrade}
            lmtd={iohLmtd.revTrade}
            gap={tradeGap}
            growth={tradeGrowth}
            accentColor="oklch(0.70 0.18 280)"
          />
          <SummaryBox
            label="Non-Trade Channel"
            mtd={iohMtd.revNonTrade}
            lmtd={iohLmtd.revNonTrade}
            gap={ntGap}
            growth={ntGrowth}
            accentColor="oklch(0.68 0.20 340)"
          />
        </div>
      )}

      {/* ── Voucher Game info banner ─────────────────────────────────────────── */}
      {!isLoading && voucherTotal !== 0 && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-xs transition-all ${
            normalizeVoucher
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-border/30 bg-accent/5 text-muted-foreground"
          }`}
        >
          <span>
            <span className="font-semibold">Voucher Game Effect:</span>{" "}
            {fmtRev(voucherTotal)} IDR
            {" · "}IM3: {fmtRev(voucherIm3)} · 3ID: {fmtRev(voucher3id)}
          </span>
          {normalizeVoucher && (
            <span className="font-semibold text-amber-400">
              ✓ Subtracted from Total Revenue
            </span>
          )}
        </div>
      )}

      {/* ── IOH Performance Table ────────────────────────────────────────────── */}
      {!isLoading && (
        <PerformanceTable
          rows={iohRows}
          title={`IOH Revenue Gap — ${periodLabel(latestMtd)} MTD vs ${periodLabel(prevMtd)} LMTD${normalizeVoucher ? " (Voucher Normalized)" : ""}`}
        />
      )}

      {/* ── Brand Comparison Table ───────────────────────────────────────────── */}
      {!isLoading && (
        <BrandPerformanceTable
          im3={im3Map}
          sid={sid3Map}
          ioh={iohMap}
          normalizeVoucher={normalizeVoucher}
          voucherIm3={voucherIm3}
          voucher3id={voucher3id}
        />
      )}
    </div>
  );
}

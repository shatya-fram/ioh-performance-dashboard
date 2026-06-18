// ─── KPI field definitions ────────────────────────────────────────────────────
export const KPI_FIELDS: Record<string, { label: string; divisor: number; unit: string; category: string }> = {
  Rev_Prepaid:       { label: "Prepaid Revenue",    divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Rev_Base:          { label: "Base Revenue",        divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Rev_Acq_M0:        { label: "Acq Revenue M0",      divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Rev_VSD:           { label: "VSD Revenue",         divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Rev_NonTrade:      { label: "Non-Trade Revenue",   divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Rev_Trade:         { label: "Trade Revenue",       divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Rev_Organic:       { label: "Organic Revenue",     divisor: 1e9,  unit: "Bn IDR",  category: "revenue" },
  Subs_RGU90D:       { label: "Subs RGU 90D",        divisor: 1e3,  unit: "K Subs",  category: "subscriber" },
  Subs_RGU30D:       { label: "Subs RGU 30D",        divisor: 1e3,  unit: "K Subs",  category: "subscriber" },
  Subs_GrossAdd:     { label: "Gross Add",           divisor: 1,    unit: "Subs",    category: "subscriber" },
  Pack_Purchase_MTD: { label: "Pack Purchase",       divisor: 1e3,  unit: "K Packs", category: "subscriber" },
  Subs_Avg_VLR_Daily:{ label: "Avg VLR Daily",       divisor: 1e3,  unit: "K Subs",  category: "subscriber" },
  M2S:               { label: "M2S",                 divisor: 1,    unit: "Subs",    category: "subscriber" },
  GA_M2S:            { label: "GA M2S",              divisor: 1,    unit: "Subs",    category: "subscriber" },
};

export const DEFAULT_KPI_FIELDS = [
  "Rev_Prepaid", "Rev_Base", "Rev_Acq_M0", "Subs_RGU90D", "Subs_GrossAdd",
  "Subs_Avg_VLR_Daily", "Pack_Purchase_MTD",
];

// ─── Formatters ───────────────────────────────────────────────────────────────
export function formatValue(value: number | null | undefined, fieldName: string): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const kpi = KPI_FIELDS[fieldName];
  const divisor = kpi?.divisor ?? 1;
  const unit = kpi?.unit ?? "";
  const v = value / divisor;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K ${unit}`;
  if (Math.abs(v) >= 1) return `${v.toFixed(2)} ${unit}`;
  return `${v.toFixed(3)} ${unit}`;
}

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(decimals)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
  return value.toFixed(decimals);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatGap(value: number | null | undefined, fieldName: string): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const kpi = KPI_FIELDS[fieldName];
  const divisor = kpi?.divisor ?? 1;
  const unit = kpi?.unit ?? "";
  const v = value / divisor;
  const sign = v >= 0 ? "+" : "";
  if (Math.abs(v) >= 1000) return `${sign}${(v / 1000).toFixed(1)}K ${unit}`;
  return `${sign}${v.toFixed(2)} ${unit}`;
}

// ─── Growth calculation ───────────────────────────────────────────────────────
export function calcGrowth(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function calcGap(current: number, previous: number): number {
  return current - previous;
}

// ─── Month label ──────────────────────────────────────────────────────────────
export function monthLabel(ym: string): string {
  if (!ym || ym.length < 6) return ym;
  const year = ym.slice(0, 4);
  const month = parseInt(ym.slice(4, 6), 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1] ?? ""} ${year.slice(2)}`;
}

// ─── Brand colors ─────────────────────────────────────────────────────────────
export const BRAND_COLORS: Record<string, string> = {
  IM3: "#FFD700",
  "3ID": "#FF00FF",
  Combined: "#00E676",
  IOH: "#00E676",
};

export const TENURE_COLORS: Record<string, string> = {
  "1. 0-1M":   "#f87171",
  "2. 1-2M":   "#fb923c",
  "3. 2-3M":   "#fbbf24",
  "4a. 3-4M":  "#a3e635",
  "4b. 4-6M":  "#34d399",
  "5. 6M-1Y":  "#22d3ee",
  "6. 1Y-2Y":  "#818cf8",
  "7. >2Y":    "#c084fc",
};

export const SEGMENT_COLORS: Record<string, string> = {
  "01. NVC": "#94a3b8",
  "02. LVC": "#38bdf8",
  "03. MVC": "#34d399",
  "04. HVC": "#f5c842",
};

// ─── Aggregate rows by field ──────────────────────────────────────────────────
export function aggregateByMonth(
  rows: Array<Record<string, any>>,
  monthField: string,
  numericFields: string[]
): Array<Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const key = String(row[monthField] ?? "");
    if (!key) continue;
    if (!map.has(key)) {
      const entry: Record<string, any> = { [monthField]: key };
      for (const f of numericFields) entry[f] = 0;
      map.set(key, entry);
    }
    const entry = map.get(key)!;
    for (const f of numericFields) {
      entry[f] = (entry[f] ?? 0) + (Number(row[f]) || 0);
    }
  }
  return Array.from(map.values()).sort((a, b) => String(a[monthField]).localeCompare(String(b[monthField])));
}

// ─── QoQ / YoY helpers ───────────────────────────────────────────────────────
export function getQoQMonths(currentYm: string): string[] {
  const year = parseInt(currentYm.slice(0, 4));
  const month = parseInt(currentYm.slice(4, 6));
  const prev3 = month - 3;
  const prevYear = prev3 <= 0 ? year - 1 : year;
  const prevMonth = prev3 <= 0 ? prev3 + 12 : prev3;
  return [`${prevYear}${String(prevMonth).padStart(2, "0")}`];
}

export function getYoYMonths(currentYm: string): string[] {
  const year = parseInt(currentYm.slice(0, 4));
  const month = currentYm.slice(4, 6);
  return [`${year - 1}${month}`];
}

export function getLMTDMonth(currentYm: string): string {
  const year = parseInt(currentYm.slice(0, 4));
  const month = parseInt(currentYm.slice(4, 6));
  const prevMonth = month - 1;
  if (prevMonth === 0) return `${year - 1}12`;
  return `${year}${String(prevMonth).padStart(2, "0")}`;
}

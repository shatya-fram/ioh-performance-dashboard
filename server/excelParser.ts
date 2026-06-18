import * as XLSX from "xlsx";
import { getDb } from "./db";
import {
  fmRaw,
  mtdRaw,
  vlrTenureRaw,
  revSegmentsRaw,
  voucherGameRaw,
  kpiConfig,
  kecRank,
} from "../drizzle/schema";

type InsertFmRow = typeof fmRaw.$inferInsert;
type InsertMtdRow = typeof mtdRaw.$inferInsert;
type InsertVlrRow = typeof vlrTenureRaw.$inferInsert;
type InsertRevSegRow = typeof revSegmentsRaw.$inferInsert;
type InsertVoucherRow = typeof voucherGameRaw.$inferInsert;
type InsertKecRankRow = typeof kecRank.$inferInsert;
type InsertKpiConfig = typeof kpiConfig.$inferInsert;

function safeNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function safeStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" || s === "nan" || s === "NaN" ? undefined : s;
}

function safeYearMonth(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().replace(/\.0$/, "");
}

// Batch insert helper
async function batchInsert<T extends object>(
  db: ReturnType<typeof import("drizzle-orm/mysql2").drizzle>,
  table: any,
  rows: T[],
  batchSize = 500
) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    if (batch.length > 0) await db.insert(table).values(batch);
  }
}

export async function parseAndStoreExcel(buffer: Buffer): Promise<{
  rowCounts: Record<string, number>;
  sheetsLoaded: string[];
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rowCounts: Record<string, number> = {};
  const sheetsLoaded: string[] = [];

  // ─── FM Inner RAW ──────────────────────────────────────────────────────────
  if (workbook.SheetNames.includes("FM Inner RAW")) {
    const ws = workbook.Sheets["FM Inner RAW"];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const rows: InsertFmRow[] = data.map((r) => ({
      yearMonth: safeYearMonth(r["YearMonth"]),
      mtd: r["MTD"] instanceof Date ? r["MTD"] : undefined,
      brand: safeStr(r["brand"]) ?? "",
      circle: safeStr(r["circle"]),
      regionCircle: safeStr(r["region_circle"]),
      area: safeStr(r["area"]),
      salesArea: safeStr(r["sales_area"]),
      microCluster: safeStr(r["micro_cluster"]),
      kabkotNm: safeStr(r["kabkot_nm"]),
      seaSegment: safeStr(r["sea_segment"]),
      tagGroupV2: safeStr(r["tag_group_v2"]),
      revPrepaid: safeNum(r["Rev_Prepaid"]),
      subsRgu90d: safeNum(r["Subs_RGU90D"]),
      subsRgu30d: safeNum(r["Subs_RGU30D"]),
      subsGrossAdd: safeNum(r["Subs_GrossAdd"]),
      packPurchaseMtd: safeNum(r["Pack_Purchase_MTD"]),
      subsAvgVlrDaily: safeNum(r["Subs_Avg_VLR_Daily"]),
      revAcqM0: safeNum(r["Rev_Acq_M0"]),
      m2s: safeNum(r["M2S"]),
      gaM2s: safeNum(r["GA_M2S"]),
      revBase: safeNum(r["Rev_Base"]),
      revVsd: safeNum(r["Rev_VSD"]),
      revNonTrade: safeNum(r["Rev_NonTrade"]),
      revTrade: safeNum(r["Rev_Trade"]),
      revOrganic: safeNum(r["Rev_Organic"]),
    })).filter((r) => r.yearMonth && r.brand);

    await db.delete(fmRaw);
    await batchInsert(db, fmRaw, rows);
    rowCounts["FM Inner RAW"] = rows.length;
    sheetsLoaded.push("FM Inner RAW");
  }

  // ─── MTD Inner RAW ─────────────────────────────────────────────────────────
  const mtdSheetName = workbook.SheetNames.find((s) => s.includes("MTD") && s.includes("Inner"));
  if (mtdSheetName) {
    const ws = workbook.Sheets[mtdSheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const rows: InsertMtdRow[] = data.map((r) => ({
      yearMonth: safeYearMonth(r["YearMonth"]),
      mtd: r["MTD"] instanceof Date ? r["MTD"] : undefined,
      brand: safeStr(r["brand"]) ?? "",
      circle: safeStr(r["circle"]),
      regionCircle: safeStr(r["region_circle"]),
      area: safeStr(r["area"]),
      salesArea: safeStr(r["sales_area"]),
      microCluster: safeStr(r["micro_cluster"]),
      kabkotNm: safeStr(r["kabkot_nm"]),
      seaSegment: safeStr(r["sea_segment"]),
      tagGroupV2: safeStr(r["tag_group_v2"]),
      revPrepaid: safeNum(r["Rev_Prepaid"]),
      subsRgu90d: safeNum(r["Subs_RGU90D"]),
      subsRgu30d: safeNum(r["Subs_RGU30D"]),
      subsGrossAdd: safeNum(r["Subs_GrossAdd"]),
      packPurchaseMtd: safeNum(r["Pack_Purchase_MTD"]),
      subsAvgVlrDaily: safeNum(r["Subs_Avg_VLR_Daily"]),
      revAcqM0: safeNum(r["Rev_Acq_M0"]),
      m2s: safeNum(r["M2S"]),
      gaM2s: safeNum(r["GA_M2S"]),
      revBase: safeNum(r["Rev_Base"]),
      revVsd: safeNum(r["Rev_VSD"]),
      revNonTrade: safeNum(r["Rev_NonTrade"]),
      revTrade: safeNum(r["Rev_Trade"]),
      revOrganic: safeNum(r["Rev_Organic"]),
    })).filter((r) => r.yearMonth && r.brand);

    await db.delete(mtdRaw);
    await batchInsert(db, mtdRaw, rows);
    rowCounts[mtdSheetName] = rows.length;
    sheetsLoaded.push(mtdSheetName);
  }

  // ─── VLR Tenure RAW ────────────────────────────────────────────────────────
  if (workbook.SheetNames.includes("VLR Tenure RAW")) {
    const ws = workbook.Sheets["VLR Tenure RAW"];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // Row 0: brand marker (3ID)
    // Row 1: monthid headers (col 6+ are YYYYMM months)
    // Row 2: field names (tnr_grp, circle, region_circle, area, kabkot_nm, kecamatan_nm, vlr_dly_fm...)
    // Rows 3+: data, brand section repeats (IM3 at ~row 1238)
    const vlrRows: InsertVlrRow[] = [];
    let currentBrand = "3ID";
    let months: string[] = [];

    for (let rowIdx = 0; rowIdx < raw.length; rowIdx++) {
      const row = raw[rowIdx] as (string | number | null)[];
      if (!row || row.length === 0) continue;

      const col0 = safeStr(row[0]);
      if (!col0) continue;

      // Detect brand marker row
      if (col0 === "IM3" || col0 === "3ID") {
        currentBrand = col0;
        months = []; // reset months for new brand section
        continue;
      }
      // Detect month header row (col0 = 'monthid', col 6+ are YYYYMM)
      if (col0 === "monthid") {
        months = [];
        for (let c = 6; c < row.length; c++) {
          const m = row[c];
          if (m && /^\d{6}$/.test(String(m).trim())) months.push(String(m).trim());
        }
        continue;
      }
      // Skip field name row and Total rows
      if (col0 === "tnr_grp" || col0 === "CIRCLE-HOR-HOS") continue;
      if (col0 === "Total") continue;
      if (!months.length) continue;

      const tenureGroup = col0;
      const circle = safeStr(row[1]);
      const regionCircle = safeStr(row[2]);
      const area = safeStr(row[3]);
      const kabkotNm = safeStr(row[4]);
      const kecamatanNm = safeStr(row[5]);

      for (let mi = 0; mi < months.length; mi++) {
        const val = safeNum(row[6 + mi]);
        if (val !== undefined) {
          vlrRows.push({
            brand: currentBrand,
            tenureGroup,
            circle,
            regionCircle,
            area,
            kabkotNm,
            kecamatanNm,
            yearMonth: months[mi],
            vlrDlyFm: val,
          });
        }
      }
    }

    await db.delete(vlrTenureRaw);
    await batchInsert(db, vlrTenureRaw, vlrRows);
    rowCounts["VLR Tenure RAW"] = vlrRows.length;
    sheetsLoaded.push("VLR Tenure RAW");
  }

  // ─── Rev Segments RAW ──────────────────────────────────────────────────────
  if (workbook.SheetNames.includes("Rev Segments RAW")) {
    const ws = workbook.Sheets["Rev Segments RAW"];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // Row 0 is header
    const segRows: InsertRevSegRow[] = [];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as (string | number | null)[];
      if (!row || !row[0]) continue;
      segRows.push({
        monthMtd: safeYearMonth(row[0]),
        brand: safeStr(row[1]) ?? "",
        kabkotNm: safeStr(row[2]),
        area: safeStr(row[3]),
        regionCircle: safeStr(row[4]),
        circle: safeStr(row[5]),
        valueSegment: safeStr(row[6]),
        subscriber: safeNum(row[7]),
      });
    }

    await db.delete(revSegmentsRaw);
    await batchInsert(db, revSegmentsRaw, segRows);
    rowCounts["Rev Segments RAW"] = segRows.length;
    sheetsLoaded.push("Rev Segments RAW");
  }

  // ─── Voucher Game RAW ──────────────────────────────────────────────────────
  if (workbook.SheetNames.includes("Voucher Game RAW")) {
    const ws = workbook.Sheets["Voucher Game RAW"];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // The Voucher Game sheet has a multi-section structure:
    // - Brand marker rows (e.g., 'IM3', '3ID') followed by
    // - Header row with daily date columns (YYYYMMDD format)
    // - Data rows: [circle, hor, hos, day1_rev, day2_rev, ...]
    // We aggregate daily values into monthly totals per brand/area
    const vgRows: InsertVoucherRow[] = [];
    const monthlyMap = new Map<string, number>(); // key: brand|area|YYYYMM

    let currentBrand = "";
    let dateCols: { idx: number; yearMonth: string }[] = [];

    for (let ri = 0; ri < raw.length; ri++) {
      const row = raw[ri] as (string | number | null)[];
      if (!row || row.every((c) => c === null || c === "")) continue;

      const firstCell = String(row[0] ?? "").trim();

      // Brand marker row (e.g., 'IM3' or '3ID')
      if (firstCell === "IM3" || firstCell === "3ID") {
        currentBrand = firstCell;
        dateCols = [];
        continue;
      }

      // Header row: detect YYYYMMDD date columns (8-digit numbers)
      if (firstCell === "dt_id" || /^\d{8}$/.test(firstCell)) {
        dateCols = [];
        for (let c = 0; c < row.length; c++) {
          const h = String(row[c] ?? "").trim();
          if (/^\d{8}$/.test(h)) {
            dateCols.push({ idx: c, yearMonth: h.slice(0, 6) });
          }
        }
        continue;
      }

      // Skip non-data rows (filter notes, empty, 'Total' only rows)
      if (!currentBrand || dateCols.length === 0) continue;
      if (firstCell.startsWith("Applied") || firstCell === "Total") continue;
      if (firstCell === "CIRCLE-HOR-HOS") continue;

      // Data row: extract area from col 2 (hos level)
      const area = safeStr(row[2]) ?? safeStr(row[1]) ?? safeStr(row[0]) ?? "";
      if (!area || area === "Total") continue;

      // Aggregate daily values into monthly totals
      for (const dc of dateCols) {
        const val = safeNum(row[dc.idx]);
        if (val === undefined || val === 0) continue;
        const mapKey = `${currentBrand}|${area}|${dc.yearMonth}`;
        monthlyMap.set(mapKey, (monthlyMap.get(mapKey) ?? 0) + val);
      }
    }

    // Convert map to rows
    for (const [key, total] of Array.from(monthlyMap.entries())) {
      const [brand, area, yearMonth] = key.split("|");
      vgRows.push({ yearMonth, brand, area, totalEffect: total });
    }

    await db.delete(voucherGameRaw);
    if (vgRows.length > 0) await batchInsert(db, voucherGameRaw, vgRows);
    rowCounts["Voucher Game RAW"] = vgRows.length;
    sheetsLoaded.push("Voucher Game RAW");
  }

  // ─── Kec Rank ──────────────────────────────────────────────────────────────
  if (workbook.SheetNames.includes("Kec Rank")) {
    const ws = workbook.Sheets["Kec Rank"];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const kecRows: InsertKecRankRow[] = data.map((r) => ({
      kecamatan: safeStr(r["kecamatan"]) ?? "",
      kabkot: safeStr(r["kabkot"]),
      im3Lmtd: safeNum(r["IM3_LMTD"]),
      im3Mtd: safeNum(r["IM3_MTD"]),
      im3Gap: safeNum(r["IM3_GAP"]),
      threeidLmtd: safeNum(r["3ID_LMTD"]),
      threeidMtd: safeNum(r["3ID_MTD"]),
      threeidGap: safeNum(r["3ID_GAP"]),
      im3HvcLmtd: safeNum(r["IM3_HVC_LMTD"]),
      im3HvcMtd: safeNum(r["IM3_HVC_MTD"]),
      im3HvcGap: safeNum(r["IM3_HVC_GAP"]),
      threeidHvcLmtd: safeNum(r["3ID_HVC_LMTD"]),
      threeidHvcMtd: safeNum(r["3ID_HVC_MTD"]),
      threeidHvcGap: safeNum(r["3ID_HVC_GAP"]),
      area: safeStr(r["(All).1"]),
    })).filter((r) => r.kecamatan);

    await db.delete(kecRank);
    await batchInsert(db, kecRank, kecRows);
    rowCounts["Kec Rank"] = kecRows.length;
    sheetsLoaded.push("Kec Rank");
  }

  // ─── KPI Config ────────────────────────────────────────────────────────────
  if (workbook.SheetNames.includes("KPI Config")) {
    const ws = workbook.Sheets["KPI Config"];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const kpiRows: InsertKpiConfig[] = data
      .filter((r) => r["Display Name"] && r["Field"])
      .map((r, i) => ({
        displayName: safeStr(r["Display Name"]) ?? "",
        fieldName: safeStr(r["Field"]) ?? "",
        divisor: safeNum(r["Divisor"]) ?? 1,
        unit: safeStr(r["Unit"]),
        colIndex: safeNum(r["Col Index"]),
        isDefault: i < 8,
        category: String(r["Field"] ?? "").startsWith("Rev") ? "revenue" : "subscriber",
        sortOrder: i,
      }));

    await db.delete(kpiConfig);
    if (kpiRows.length > 0) await db.insert(kpiConfig).values(kpiRows);
    rowCounts["KPI Config"] = kpiRows.length;
    sheetsLoaded.push("KPI Config");
  }

  return { rowCounts, sheetsLoaded };
}

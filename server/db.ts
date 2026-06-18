import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  fmRaw,
  mtdRaw,
  vlrTenureRaw,
  revSegmentsRaw,
  voucherGameRaw,
  kpiConfig,
  kecRank,
  dataUploads,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Upload tracking ──────────────────────────────────────────────────────────
export async function createUpload(filename: string) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(dataUploads).values({ filename, status: "processing" });
  return (result as any).insertId as number;
}

export async function updateUpload(
  id: number,
  data: { sheetsLoaded?: string; rowCounts?: string; status?: string; errorMessage?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(dataUploads).set(data).where(eq(dataUploads.id, id));
}

export async function getLatestUpload() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(dataUploads)
    .where(eq(dataUploads.status, "done"))
    .orderBy(desc(dataUploads.uploadedAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getUploads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataUploads).orderBy(desc(dataUploads.uploadedAt)).limit(10);
}

// ─── KPI Config ───────────────────────────────────────────────────────────────
export async function getKpiConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(kpiConfig).orderBy(asc(kpiConfig.sortOrder));
}

export async function upsertKpiConfigs(
  configs: Array<{
    displayName: string;
    fieldName: string;
    divisor?: number;
    unit?: string;
    colIndex?: number;
    isDefault?: boolean;
    category?: string;
    sortOrder?: number;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.delete(kpiConfig);
  if (configs.length > 0) await db.insert(kpiConfig).values(configs);
}

// ─── Geographic hierarchy ─────────────────────────────────────────────────────
export async function getGeographyHierarchy() {
  const db = await getDb();
  if (!db) return { regions: [], areas: [], branches: [], kabkots: [] };

  const rows = await db
    .selectDistinct({
      regionCircle: fmRaw.regionCircle,
      area: fmRaw.area,
      salesArea: fmRaw.salesArea,
      kabkotNm: fmRaw.kabkotNm,
    })
    .from(fmRaw)
    .orderBy(asc(fmRaw.regionCircle), asc(fmRaw.area), asc(fmRaw.salesArea), asc(fmRaw.kabkotNm));

  const regions = Array.from(new Set(rows.map((r) => r.regionCircle).filter(Boolean)));
  const areas = Array.from(new Set(rows.map((r) => r.area).filter(Boolean)));
  const branches = Array.from(new Set(rows.map((r) => r.salesArea).filter(Boolean)));
  const kabkots = Array.from(new Set(rows.map((r) => r.kabkotNm).filter(Boolean)));

  return { regions, areas, branches, kabkots, hierarchy: rows };
}

export async function getKecamatanList(kabkot?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.selectDistinct({ kecamatan: kecRank.kecamatan, kabkot: kecRank.kabkot }).from(kecRank);
  const rows = kabkot ? await query.where(eq(kecRank.kabkot, kabkot)) : await query;
  return rows;
}

// ─── FM Raw queries ───────────────────────────────────────────────────────────
export interface KpiFilter {
  brands?: string[];
  areas?: string[];
  salesAreas?: string[];
  kabkots?: string[];
  yearMonths?: string[];
}

function buildFmConditions(filter: KpiFilter) {
  const conditions = [];
  if (filter.brands?.length) conditions.push(inArray(fmRaw.brand, filter.brands));
  if (filter.areas?.length) conditions.push(inArray(fmRaw.area, filter.areas));
  if (filter.salesAreas?.length) conditions.push(inArray(fmRaw.salesArea, filter.salesAreas));
  if (filter.kabkots?.length) conditions.push(inArray(fmRaw.kabkotNm, filter.kabkots));
  if (filter.yearMonths?.length) conditions.push(inArray(fmRaw.yearMonth, filter.yearMonths));
  return conditions;
}

export async function getFmTrend(filter: KpiFilter) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildFmConditions(filter);
  const rows = await db
    .select({
      yearMonth: fmRaw.yearMonth,
      brand: fmRaw.brand,
      revPrepaid: sql<number>`SUM(${fmRaw.revPrepaid})`,
      subsRgu90d: sql<number>`SUM(${fmRaw.subsRgu90d})`,
      subsRgu30d: sql<number>`SUM(${fmRaw.subsRgu30d})`,
      subsGrossAdd: sql<number>`SUM(${fmRaw.subsGrossAdd})`,
      packPurchaseMtd: sql<number>`SUM(${fmRaw.packPurchaseMtd})`,
      subsAvgVlrDaily: sql<number>`SUM(${fmRaw.subsAvgVlrDaily})`,
      revAcqM0: sql<number>`SUM(${fmRaw.revAcqM0})`,
      m2s: sql<number>`SUM(${fmRaw.m2s})`,
      gaM2s: sql<number>`SUM(${fmRaw.gaM2s})`,
      revBase: sql<number>`SUM(${fmRaw.revBase})`,
      revVsd: sql<number>`SUM(${fmRaw.revVsd})`,
      revNonTrade: sql<number>`SUM(${fmRaw.revNonTrade})`,
      revTrade: sql<number>`SUM(${fmRaw.revTrade})`,
      revOrganic: sql<number>`SUM(${fmRaw.revOrganic})`,
    })
    .from(fmRaw)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(fmRaw.yearMonth, fmRaw.brand)
    .orderBy(asc(fmRaw.yearMonth), asc(fmRaw.brand));
  return rows;
}

export async function getFmByBranch(filter: KpiFilter) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildFmConditions(filter);
  return db
    .select({
      yearMonth: fmRaw.yearMonth,
      brand: fmRaw.brand,
      salesArea: fmRaw.salesArea,
      kabkotNm: fmRaw.kabkotNm,
      revPrepaid: sql<number>`SUM(${fmRaw.revPrepaid})`,
      subsRgu90d: sql<number>`SUM(${fmRaw.subsRgu90d})`,
      subsRgu30d: sql<number>`SUM(${fmRaw.subsRgu30d})`,
      subsGrossAdd: sql<number>`SUM(${fmRaw.subsGrossAdd})`,
      packPurchaseMtd: sql<number>`SUM(${fmRaw.packPurchaseMtd})`,
      subsAvgVlrDaily: sql<number>`SUM(${fmRaw.subsAvgVlrDaily})`,
      revAcqM0: sql<number>`SUM(${fmRaw.revAcqM0})`,
      revBase: sql<number>`SUM(${fmRaw.revBase})`,
      revNonTrade: sql<number>`SUM(${fmRaw.revNonTrade})`,
      revTrade: sql<number>`SUM(${fmRaw.revTrade})`,
      revOrganic: sql<number>`SUM(${fmRaw.revOrganic})`,
    })
    .from(fmRaw)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(fmRaw.yearMonth, fmRaw.brand, fmRaw.salesArea, fmRaw.kabkotNm)
    .orderBy(asc(fmRaw.yearMonth), asc(fmRaw.salesArea));
}

// ─── MTD Raw queries ──────────────────────────────────────────────────────────
function buildMtdConditions(filter: KpiFilter) {
  const conditions = [];
  if (filter.brands?.length) conditions.push(inArray(mtdRaw.brand, filter.brands));
  if (filter.areas?.length) conditions.push(inArray(mtdRaw.area, filter.areas));
  if (filter.salesAreas?.length) conditions.push(inArray(mtdRaw.salesArea, filter.salesAreas));
  if (filter.kabkots?.length) conditions.push(inArray(mtdRaw.kabkotNm, filter.kabkots));
  if (filter.yearMonths?.length) conditions.push(inArray(mtdRaw.yearMonth, filter.yearMonths));
  return conditions;
}

export async function getMtdTrend(filter: KpiFilter) {
  const db = await getDb();
  if (!db) return [];
  const conditions = buildMtdConditions(filter);
  return db
    .select({
      yearMonth: mtdRaw.yearMonth,
      brand: mtdRaw.brand,
      revPrepaid: sql<number>`SUM(${mtdRaw.revPrepaid})`,
      subsRgu90d: sql<number>`SUM(${mtdRaw.subsRgu90d})`,
      subsRgu30d: sql<number>`SUM(${mtdRaw.subsRgu30d})`,
      subsGrossAdd: sql<number>`SUM(${mtdRaw.subsGrossAdd})`,
      packPurchaseMtd: sql<number>`SUM(${mtdRaw.packPurchaseMtd})`,
      subsAvgVlrDaily: sql<number>`SUM(${mtdRaw.subsAvgVlrDaily})`,
      revAcqM0: sql<number>`SUM(${mtdRaw.revAcqM0})`,
      revBase: sql<number>`SUM(${mtdRaw.revBase})`,
      revNonTrade: sql<number>`SUM(${mtdRaw.revNonTrade})`,
      revTrade: sql<number>`SUM(${mtdRaw.revTrade})`,
      revOrganic: sql<number>`SUM(${mtdRaw.revOrganic})`,
    })
    .from(mtdRaw)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(mtdRaw.yearMonth, mtdRaw.brand)
    .orderBy(asc(mtdRaw.yearMonth), asc(mtdRaw.brand));
}

// ─── VLR Tenure queries ───────────────────────────────────────────────────────
export async function getVlrTrend(filter: {
  brands?: string[];
  areas?: string[];
  kabkots?: string[];
  tenureGroups?: string[];
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter.brands?.length) conditions.push(inArray(vlrTenureRaw.brand, filter.brands));
  if (filter.areas?.length) conditions.push(inArray(vlrTenureRaw.area, filter.areas));
  if (filter.kabkots?.length) conditions.push(inArray(vlrTenureRaw.kabkotNm, filter.kabkots));
  if (filter.tenureGroups?.length) conditions.push(inArray(vlrTenureRaw.tenureGroup, filter.tenureGroups));
  return db
    .select({
      yearMonth: vlrTenureRaw.yearMonth,
      brand: vlrTenureRaw.brand,
      tenureGroup: vlrTenureRaw.tenureGroup,
      area: vlrTenureRaw.area,
      kabkotNm: vlrTenureRaw.kabkotNm,
      kecamatanNm: vlrTenureRaw.kecamatanNm,
      vlrDlyFm: sql<number>`SUM(${vlrTenureRaw.vlrDlyFm})`,
    })
    .from(vlrTenureRaw)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(
      vlrTenureRaw.yearMonth,
      vlrTenureRaw.brand,
      vlrTenureRaw.tenureGroup,
      vlrTenureRaw.area,
      vlrTenureRaw.kabkotNm,
      vlrTenureRaw.kecamatanNm
    )
    .orderBy(asc(vlrTenureRaw.yearMonth), asc(vlrTenureRaw.brand), asc(vlrTenureRaw.tenureGroup));
}

// ─── Rev Segments queries ─────────────────────────────────────────────────────
export async function getRevSegmentsTrend(filter: {
  brands?: string[];
  areas?: string[];
  kabkots?: string[];
  segments?: string[];
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter.brands?.length) conditions.push(inArray(revSegmentsRaw.brand, filter.brands));
  if (filter.areas?.length) conditions.push(inArray(revSegmentsRaw.area, filter.areas));
  if (filter.kabkots?.length) conditions.push(inArray(revSegmentsRaw.kabkotNm, filter.kabkots));
  if (filter.segments?.length) conditions.push(inArray(revSegmentsRaw.valueSegment, filter.segments));
  return db
    .select({
      monthMtd: revSegmentsRaw.monthMtd,
      brand: revSegmentsRaw.brand,
      kabkotNm: revSegmentsRaw.kabkotNm,
      area: revSegmentsRaw.area,
      valueSegment: revSegmentsRaw.valueSegment,
      subscriber: sql<number>`SUM(${revSegmentsRaw.subscriber})`,
    })
    .from(revSegmentsRaw)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(
      revSegmentsRaw.monthMtd,
      revSegmentsRaw.brand,
      revSegmentsRaw.kabkotNm,
      revSegmentsRaw.area,
      revSegmentsRaw.valueSegment
    )
    .orderBy(asc(revSegmentsRaw.monthMtd), asc(revSegmentsRaw.brand));
}

// ─── Voucher Game queries ─────────────────────────────────────────────────────
export async function getVoucherGameData(filter: { brands?: string[]; areas?: string[] }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter.brands?.length) conditions.push(inArray(voucherGameRaw.brand, filter.brands));
  if (filter.areas?.length) conditions.push(inArray(voucherGameRaw.area, filter.areas));
  return db
    .select()
    .from(voucherGameRaw)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(voucherGameRaw.yearMonth));
}

// ─── Kec Rank queries ─────────────────────────────────────────────────────────
export async function getKecRankData(filter: { kabkots?: string[] }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filter.kabkots?.length) conditions.push(inArray(kecRank.kabkot, filter.kabkots));
  return db
    .select()
    .from(kecRank)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(kecRank.im3Gap));
}

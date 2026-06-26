import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  double,
  bigint,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

// ─── Auth ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Upload tracking ─────────────────────────────────────────────────────────
export const dataUploads = mysqlTable("data_uploads", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  sheetsLoaded: text("sheetsLoaded"), // JSON array of sheet names
  rowCounts: text("rowCounts"),       // JSON object {sheetName: count}
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  errorMessage: text("errorMessage"),
});

// ─── KPI Config ──────────────────────────────────────────────────────────────
export const kpiConfig = mysqlTable("kpi_config", {
  id: int("id").autoincrement().primaryKey(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  fieldName: varchar("fieldName", { length: 64 }).notNull(),
  divisor: double("divisor").default(1),
  unit: varchar("unit", { length: 32 }),
  colIndex: int("colIndex"),
  isDefault: boolean("isDefault").default(false),
  category: varchar("category", { length: 64 }).default("revenue"),
  sortOrder: int("sortOrder").default(0),
});

// ─── FM Inner RAW ─────────────────────────────────────────────────────────────
export const fmRaw = mysqlTable("fm_raw", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("yearMonth", { length: 8 }).notNull(),
  mtd: timestamp("mtd"),
  brand: varchar("brand", { length: 16 }).notNull(),
  circle: varchar("circle", { length: 64 }),
  regionCircle: varchar("regionCircle", { length: 64 }),
  area: varchar("area", { length: 64 }),
  salesArea: varchar("salesArea", { length: 64 }),
  microCluster: varchar("microCluster", { length: 128 }),
  kabkotNm: varchar("kabkotNm", { length: 64 }),
  seaSegment: varchar("seaSegment", { length: 64 }),
  tagGroupV2: varchar("tagGroupV2", { length: 64 }),
  revPrepaid: double("revPrepaid"),
  subsRgu90d: double("subsRgu90d"),
  subsRgu30d: double("subsRgu30d"),
  subsGrossAdd: double("subsGrossAdd"),
  packPurchaseMtd: double("packPurchaseMtd"),
  subsAvgVlrDaily: double("subsAvgVlrDaily"),
  revAcqM0: double("revAcqM0"),
  m2s: double("m2s"),
  gaM2s: double("gaM2s"),
  revBase: double("revBase"),
  revVsd: double("revVsd"),
  revNonTrade: double("revNonTrade"),
  revTrade: double("revTrade"),
  revOrganic: double("revOrganic"),
}, (t) => [
  index("fm_raw_yearmonth_brand").on(t.yearMonth, t.brand),
  index("fm_raw_area").on(t.area),
  index("fm_raw_kabkot").on(t.kabkotNm),
]);

// ─── MTD Inner RAW ────────────────────────────────────────────────────────────
export const mtdRaw = mysqlTable("mtd_raw", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("yearMonth", { length: 8 }).notNull(),
  mtd: timestamp("mtd"),
  brand: varchar("brand", { length: 16 }).notNull(),
  circle: varchar("circle", { length: 64 }),
  regionCircle: varchar("regionCircle", { length: 64 }),
  area: varchar("area", { length: 64 }),
  salesArea: varchar("salesArea", { length: 64 }),
  microCluster: varchar("microCluster", { length: 128 }),
  kabkotNm: varchar("kabkotNm", { length: 64 }),
  seaSegment: varchar("seaSegment", { length: 64 }),
  tagGroupV2: varchar("tagGroupV2", { length: 64 }),
  revPrepaid: double("revPrepaid"),
  subsRgu90d: double("subsRgu90d"),
  subsRgu30d: double("subsRgu30d"),
  subsGrossAdd: double("subsGrossAdd"),
  packPurchaseMtd: double("packPurchaseMtd"),
  subsAvgVlrDaily: double("subsAvgVlrDaily"),
  revAcqM0: double("revAcqM0"),
  m2s: double("m2s"),
  gaM2s: double("gaM2s"),
  revBase: double("revBase"),
  revVsd: double("revVsd"),
  revNonTrade: double("revNonTrade"),
  revTrade: double("revTrade"),
  revOrganic: double("revOrganic"),
}, (t) => [
  index("mtd_raw_yearmonth_brand").on(t.yearMonth, t.brand),
  index("mtd_raw_area").on(t.area),
  index("mtd_raw_kabkot").on(t.kabkotNm),
]);

// ─── Voucher Game RAW ─────────────────────────────────────────────────────────
export const voucherGameRaw = mysqlTable("voucher_game_raw", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("yearMonth", { length: 8 }).notNull(),
  brand: varchar("brand", { length: 16 }),
  area: varchar("area", { length: 64 }),
  kabkotNm: varchar("kabkotNm", { length: 64 }),
  voucherRevenue: double("voucherRevenue"),
  gameRevenue: double("gameRevenue"),
  totalEffect: double("totalEffect"),
});

// ─── VLR Tenure RAW ───────────────────────────────────────────────────────────
export const vlrTenureRaw = mysqlTable("vlr_tenure_raw", {
  id: int("id").autoincrement().primaryKey(),
  brand: varchar("brand", { length: 16 }).notNull(),
  tenureGroup: varchar("tenureGroup", { length: 32 }).notNull(),
  circle: varchar("circle", { length: 64 }),
  regionCircle: varchar("regionCircle", { length: 64 }),
  area: varchar("area", { length: 64 }),
  kabkotNm: varchar("kabkotNm", { length: 64 }),
  kecamatanNm: varchar("kecamatanNm", { length: 128 }),
  yearMonth: varchar("yearMonth", { length: 8 }).notNull(),
  vlrDlyFm: double("vlrDlyFm"),
}, (t) => [
  index("vlr_tenure_brand_month").on(t.brand, t.yearMonth),
  index("vlr_tenure_area").on(t.area),
  index("vlr_tenure_kec").on(t.kecamatanNm),
]);

// ─── Rev Segments RAW ─────────────────────────────────────────────────────────
export const revSegmentsRaw = mysqlTable("rev_segments_raw", {
  id: int("id").autoincrement().primaryKey(),
  monthMtd: varchar("monthMtd", { length: 8 }).notNull(),
  brand: varchar("brand", { length: 16 }).notNull(),
  kabkotNm: varchar("kabkotNm", { length: 64 }),
  area: varchar("area", { length: 64 }),
  regionCircle: varchar("regionCircle", { length: 64 }),
  circle: varchar("circle", { length: 64 }),
  valueSegment: varchar("valueSegment", { length: 32 }),
  subscriber: double("subscriber"),
}, (t) => [
  index("rev_seg_brand_month").on(t.brand, t.monthMtd),
  index("rev_seg_kabkot").on(t.kabkotNm),
]);

// ─── Kec Rank (pre-computed) ──────────────────────────────────────────────────
export const kecRank = mysqlTable("kec_rank", {
  id: int("id").autoincrement().primaryKey(),
  kecamatan: varchar("kecamatan", { length: 128 }).notNull(),
  kabkot: varchar("kabkot", { length: 64 }),
  im3Lmtd: double("im3Lmtd"),
  im3Mtd: double("im3Mtd"),
  im3Gap: double("im3Gap"),
  threeidLmtd: double("threeidLmtd"),
  threeidMtd: double("threeidMtd"),
  threeidGap: double("threeidGap"),
  im3HvcLmtd: double("im3HvcLmtd"),
  im3HvcMtd: double("im3HvcMtd"),
  im3HvcGap: double("im3HvcGap"),
  threeidHvcLmtd: double("threeidHvcLmtd"),
  threeidHvcMtd: double("threeidHvcMtd"),
  threeidHvcGap: double("threeidHvcGap"),
  area: varchar("area", { length: 64 }),
});

// ─── Product MTD RAW ─────────────────────────────────────────────────────────
export const productMtdRaw = mysqlTable("product_mtd_raw", {
  id: int("id").autoincrement().primaryKey(),
  yearMonth: varchar("yearMonth", { length: 8 }).notNull(),
  brand: varchar("brand", { length: 16 }).notNull(),
  areaRegion: varchar("areaRegion", { length: 64 }),
  areaBranch: varchar("areaBranch", { length: 64 }),
  areaKabkot: varchar("areaKabkot", { length: 64 }),
  channelGroup: varchar("channelGroup", { length: 64 }),
  channelDetail: varchar("channelDetail", { length: 64 }),
  productFamily: varchar("productFamily", { length: 128 }),
  productGroup: varchar("productGroup", { length: 256 }),
  atlBtl: varchar("atlBtl", { length: 16 }),
  atlBtlDetail: varchar("atlBtlDetail", { length: 64 }),
  tenure: varchar("tenure", { length: 32 }),
  merchant: varchar("merchant", { length: 128 }),
  kpi: varchar("kpi", { length: 64 }).notNull(),
  rev: bigint("rev", { mode: "number" }),
}, (t) => [
  index("prod_mtd_brand_month").on(t.brand, t.yearMonth),
  index("prod_mtd_channel").on(t.channelGroup),
  index("prod_mtd_kpi").on(t.kpi),
  index("prod_mtd_branch").on(t.areaBranch),
  index("prod_mtd_kabkot").on(t.areaKabkot),
]);

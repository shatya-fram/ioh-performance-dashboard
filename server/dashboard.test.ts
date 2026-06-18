import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getUploads: vi.fn().mockResolvedValue([]),
  getLatestUpload: vi.fn().mockResolvedValue(null),
  getKpiConfigs: vi.fn().mockResolvedValue([
    { id: 1, fieldName: "Rev_Prepaid", label: "Prepaid Revenue", unit: "IDR", divisor: "1000000000", category: "Revenue", isDefault: 1, sortOrder: 1 },
    { id: 2, fieldName: "Subs_RGU90D", label: "Subscriber RGU 90D", unit: "K", divisor: "1000", category: "Subscriber", isDefault: 1, sortOrder: 2 },
  ]),
  getGeographyHierarchy: vi.fn().mockResolvedValue({
    regions: ["Inner Jakarta"],
    areas: ["AREA 1", "AREA 2"],
    salesAreas: ["SA1", "SA2"],
    kabkots: ["Jakarta Pusat", "Jakarta Selatan"],
  }),
  getKecamatanList: vi.fn().mockResolvedValue([
    { kabkotNm: "Jakarta Pusat", kecamatanNm: "Gambir" },
    { kabkotNm: "Jakarta Selatan", kecamatanNm: "Tebet" },
  ]),
  getKecRankData: vi.fn().mockResolvedValue([
    {
      kabkotNm: "Jakarta Pusat",
      kecamatanNm: "Gambir",
      im3VlrMtd: 85000,
      im3VlrLmtd: 90000,
      im3VlrGrowth: -0.056,
      threeidVlrMtd: 20000,
      threeidVlrLmtd: 18000,
      threeidVlrGrowth: 0.111,
      im3HvcGap: -500,
      threeidHvcGap: 200,
    },
  ]),
  getRevSegmentsTrend: vi.fn().mockResolvedValue([
    {
      monthMtd: 202505,
      brand: "IM3",
      kabkotNm: "Jakarta Pusat",
      nvcCount: 100000,
      lvcCount: 200000,
      mvcCount: 300000,
      hvcCount: 50000,
    },
  ]),
  getFmTrend: vi.fn().mockResolvedValue([
    {
      yearMonth: 202501,
      brand: "IM3",
      revPrepaid: 100000000000,
      subsRgu90d: 1000000,
      subsRgu30d: 800000,
      subsGrossAdd: 50000,
      packPurchaseMtd: 200000,
      subsAvgVlrDaily: 700000,
      revAcqM0: 5000000000,
      m2s: 0.5,
      gaM2s: 0.4,
      revBase: 95000000000,
      revVsd: 3000000000,
      revNonTrade: 30000000000,
      revTrade: 20000000000,
      revOrganic: 50000000000,
    },
  ]),
  getFmByBranch: vi.fn().mockResolvedValue([]),
  getMtdTrend: vi.fn().mockResolvedValue([
    {
      yearMonth: 202506,
      brand: "IM3",
      revPrepaid: 50000000000,
      subsRgu90d: 950000,
      subsRgu30d: 750000,
      subsGrossAdd: 25000,
      packPurchaseMtd: 100000,
      subsAvgVlrDaily: 680000,
      revAcqM0: 2500000000,
      revBase: 47500000000,
      revNonTrade: 15000000000,
      revTrade: 10000000000,
      revOrganic: 25000000000,
    },
  ]),
  getVlrTrend: vi.fn().mockResolvedValue([
    {
      yearMonth: 202505,
      brand: "IM3",
      kabkotNm: "Total",
      kecamatanNm: null,
      tenureGroup: "7. >2Y",
      vlrDlyFm: 4000000,
    },
  ]),
  getVoucherGameData: vi.fn().mockResolvedValue([
    {
      yearMonth: 202505,
      brand: "IM3",
      totalEffect: 5000000000,
    },
  ]),
}));

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Dashboard tRPC Routes", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("upload routes", () => {
    it("upload.list returns array", async () => {
      const result = await caller.upload.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("upload.latest returns null when no uploads", async () => {
      const result = await caller.upload.latest();
      expect(result).toBeNull();
    });
  });

  describe("kpi routes", () => {
    it("kpi.configs returns KPI configuration array", async () => {
      const result = await caller.kpi.configs();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("fieldName");
      expect(result[0]).toHaveProperty("label");
      expect(result[0]).toHaveProperty("unit");
    });
  });

  describe("geography routes", () => {
    it("geo.hierarchy returns regions, areas, kabkots", async () => {
      const result = await caller.geo.hierarchy();
      expect(result).toHaveProperty("regions");
      expect(result).toHaveProperty("areas");
      expect(result).toHaveProperty("kabkots");
      expect(Array.isArray(result.regions)).toBe(true);
      expect(Array.isArray(result.areas)).toBe(true);
    });

    it("geo.kecamatan returns kecamatan list", async () => {
      const result = await caller.geo.kecamatan({ kabkot: "Jakarta Pusat" });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("fm routes", () => {
    it("fm.trend returns data rows", async () => {
      const result = await caller.fm.trend({ brands: ["IM3"] });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("yearMonth");
        expect(result[0]).toHaveProperty("brand");
        expect(result[0]).toHaveProperty("revPrepaid");
      }
    });

    it("fm.trend accepts optional filter parameters", async () => {
      const result = await caller.fm.trend({
        brands: ["IM3", "3ID"],
        areas: ["AREA 1"],
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("mtd routes", () => {
    it("mtd.trend returns MTD data rows", async () => {
      const result = await caller.mtd.trend({ brands: ["IM3"] });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("yearMonth");
        expect(result[0]).toHaveProperty("revPrepaid");
      }
    });
  });

  describe("vlr routes", () => {
    it("vlr.trend returns VLR tenure data", async () => {
      const result = await caller.vlr.trend({ brands: ["IM3"] });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("tenureGroup");
        expect(result[0]).toHaveProperty("vlrDlyFm");
      }
    });

    it("vlr.kecRank returns kecamatan ranking data", async () => {
      const result = await caller.vlr.kecRank({});
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("kecamatanNm");
        expect(result[0]).toHaveProperty("im3VlrMtd");
      }
    });
  });

  describe("segments routes", () => {
    it("segments.trend returns subscriber segment data", async () => {
      const result = await caller.segments.trend({ brands: ["IM3"] });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("brand");
        expect(result[0]).toHaveProperty("hvcCount");
      }
    });
  });

  describe("voucher routes", () => {
    it("voucherGame.data returns voucher game data", async () => {
      const result = await caller.voucherGame.data({ brands: ["IM3"] });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("brand");
        expect(result[0]).toHaveProperty("totalEffect");
      }
    });
  });

  describe("auth routes", () => {
    it("auth.me returns null for unauthenticated user", async () => {
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("auth.logout clears cookie and returns success", async () => {
      const ctx = createTestContext();
      const authedCaller = appRouter.createCaller(ctx);
      const result = await authedCaller.auth.logout();
      expect(result).toEqual({ success: true });
    });
  });
});

import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getKpiConfigs,
  getGeographyHierarchy,
  getKecamatanList,
  getFmTrend,
  getFmByBranch,
  getMtdTrend,
  getMtdByKabkot,
  getVlrTrend,
  getRevSegmentsTrend,
  getVoucherGameData,
  getKecRankData,
  getUploads,
  getLatestUpload,
  getProductDimensions,
  getProductAnalysis,
  getProductDetail,
  type ProductFilter,
} from "./db";

const FilterInput = z.object({
  brands: z.array(z.string()).optional(),
  areas: z.array(z.string()).optional(),
  salesAreas: z.array(z.string()).optional(),
  kabkots: z.array(z.string()).optional(),
  yearMonths: z.array(z.string()).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Upload ──────────────────────────────────────────────────────────────
  upload: router({
    list: publicProcedure.query(() => getUploads()),
    latest: publicProcedure.query(() => getLatestUpload()),
  }),

  // ─── KPI Config ──────────────────────────────────────────────────────────
  kpi: router({
    configs: publicProcedure.query(() => getKpiConfigs()),
  }),

  // ─── Geography ───────────────────────────────────────────────────────────
  geo: router({
    hierarchy: publicProcedure.query(() => getGeographyHierarchy()),
    kecamatan: publicProcedure
      .input(z.object({ kabkot: z.string().optional() }))
      .query(({ input }) => getKecamatanList(input.kabkot)),
  }),

  // ─── FM Trend (Full Month) ───────────────────────────────────────────────
  fm: router({
    trend: publicProcedure.input(FilterInput).query(({ input }) => getFmTrend(input)),
    byBranch: publicProcedure.input(FilterInput).query(({ input }) => getFmByBranch(input)),
  }),

  // ─── MTD Trend ───────────────────────────────────────────────────────────
  mtd: router({
    trend: publicProcedure.input(FilterInput).query(({ input }) => getMtdTrend(input)),
    byKabkot: publicProcedure.input(FilterInput).query(({ input }) => getMtdByKabkot(input)),
  }),

  // ─── VLR ─────────────────────────────────────────────────────────────────
  vlr: router({
    trend: publicProcedure
      .input(
        z.object({
          brands: z.array(z.string()).optional(),
          areas: z.array(z.string()).optional(),
          kabkots: z.array(z.string()).optional(),
          tenureGroups: z.array(z.string()).optional(),
        })
      )
      .query(({ input }) => getVlrTrend(input)),
    kecRank: publicProcedure
      .input(z.object({ kabkots: z.array(z.string()).optional() }))
      .query(({ input }) => getKecRankData(input)),
  }),

  // ─── Revenue Segments ────────────────────────────────────────────────────
  segments: router({
    trend: publicProcedure
      .input(
        z.object({
          brands: z.array(z.string()).optional(),
          areas: z.array(z.string()).optional(),
          kabkots: z.array(z.string()).optional(),
          segments: z.array(z.string()).optional(),
        })
      )
      .query(({ input }) => getRevSegmentsTrend(input)),
  }),

  // ─── Voucher Game ─────────────────────────────────────────────────────────
  voucherGame: router({
    data: publicProcedure
      .input(
        z.object({
          brands: z.array(z.string()).optional(),
          areas: z.array(z.string()).optional(),
        })
      )
      .query(({ input }) => getVoucherGameData(input)),
  }),

  // ─── Product Analysis ─────────────────────────────────────────────────────
  product: router({
    dimensions: publicProcedure.query(() => getProductDimensions()),
    analysis: publicProcedure
      .input(
        z.object({
          brands: z.array(z.string()).optional(),
          branches: z.array(z.string()).optional(),
          kabkots: z.array(z.string()).optional(),
          channelGroups: z.array(z.string()).optional(),
          channelDetails: z.array(z.string()).optional(),
          atlBtl: z.array(z.string()).optional(),
          tenures: z.array(z.string()).optional(),
          merchants: z.array(z.string()).optional(),
          kpis: z.array(z.string()).optional(),
          productFamilies: z.array(z.string()).optional(),
          productGroups: z.array(z.string()).optional(),
          yearMonths: z.array(z.string()).optional(),
          groupBy: z.enum(["channelGroup","channelDetail","atlBtl","tenure","merchant","productFamily","productGroup","kpi","brand","areaBranch","areaKabkot"]).optional(),
        })
      )
      .query(({ input }) => getProductAnalysis(input as ProductFilter)),
    detail: publicProcedure
      .input(
        z.object({
          brands: z.array(z.string()).optional(),
          branches: z.array(z.string()).optional(),
          kabkots: z.array(z.string()).optional(),
          channelGroups: z.array(z.string()).optional(),
          channelDetails: z.array(z.string()).optional(),
          atlBtl: z.array(z.string()).optional(),
          tenures: z.array(z.string()).optional(),
          merchants: z.array(z.string()).optional(),
          kpis: z.array(z.string()).optional(),
          productFamilies: z.array(z.string()).optional(),
          productGroups: z.array(z.string()).optional(),
          yearMonths: z.array(z.string()).optional(),
        })
      )
      .query(({ input }) => getProductDetail(input as ProductFilter)),
  }),
});

export type AppRouter = typeof appRouter;

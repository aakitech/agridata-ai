import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { AnalyticsService } from "~/server/modules/analytics/analytics-service";

export const analyticsRouter = createTRPCRouter({
  getStats: protectedProcedure
    .input(
      z.object({ 
        filterOrgId: z.string().uuid().optional(),
        range: z.enum(["7d", "30d"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getStats(input?.filterOrgId, input?.range);
    }),

  getReportsOverTime: protectedProcedure
    .input(z.object({ 
      range: z.enum(["7d", "30d"]).default("7d"),
      filterOrgId: z.string().uuid().optional() 
    }))
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getReportsOverTime(input.range, input.filterOrgId);
    }),

  getPestDistribution: protectedProcedure
    .input(
      z.object({ 
        filterOrgId: z.string().uuid().optional(),
        range: z.enum(["7d", "30d"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getPestDistribution(input?.filterOrgId, input?.range);
    }),

  getRecentActivity: protectedProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(20).default(5),
      filterOrgId: z.string().uuid().optional(),
      range: z.enum(["7d", "30d"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getRecentReports(input?.limit, input?.filterOrgId, input?.range);
    }),

  getMapPoints: protectedProcedure
    .input(
      z.object({ 
        filterOrgId: z.string().uuid().optional(),
        range: z.enum(["7d", "30d"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getMapPoints(input?.filterOrgId, input?.range);
    }),

  // Reports page endpoints
  getAllReports: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        severity: z.enum(["HIGH", "WARNING", "NORMAL"]).optional(),
        officerId: z.string().uuid().optional(),
        orgId: z.string().uuid().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getAllReports({
        startDate: input?.startDate,
        severity: input?.severity,
        officerId: input?.officerId,
        orgId: input?.orgId,
        page: input?.page,
        limit: input?.limit,
      });
    }),

  getReportsByLocation: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        severity: z.enum(["HIGH", "WARNING", "NORMAL"]).optional(),
        officerId: z.string().uuid().optional(),
        orgId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getReportsByLocation({
        startDate: input?.startDate,
        severity: input?.severity,
        officerId: input?.officerId,
        orgId: input?.orgId,
      });
    }),
});

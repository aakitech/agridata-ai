import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { AnalyticsService } from "~/server/modules/analytics/analytics-service";

export const analyticsRouter = createTRPCRouter({
  getStats: protectedProcedure
    .input(z.object({ filterOrgId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getStats(input?.filterOrgId);
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
    .input(z.object({ filterOrgId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getPestDistribution(input?.filterOrgId);
    }),

  getRecentActivity: protectedProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(20).default(5),
      filterOrgId: z.string().uuid().optional() 
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getRecentReports(input?.limit, input?.filterOrgId);
    }),

  getMapPoints: protectedProcedure
    .input(z.object({ filterOrgId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const service = new AnalyticsService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getMapPoints(input?.filterOrgId);
    }),
});

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TriageService } from "~/server/modules/triage/triage-service";

export const reportsRouter = createTRPCRouter({
  // Get reports by status
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.enum(["PENDING_TRIAGE", "VERIFIED", "REJECTED"]).optional().default("PENDING_TRIAGE"),
        filterOrgId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only super admins can access triage" });
      }
      // Pass orgId from authenticated user context
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getReportsByStatus(input.status, input.filterOrgId);
    }),

  // Get a single report by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only super admins can access triage" });
      }
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getReportById(input.id);
    }),

  // Verify a report
  verify: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        diagnosis: z.string().min(1, "Diagnosis is required"),
        riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.verifyReport(input, ctx.appUser.id);
    }),

  // Reject a report
  reject: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        rejectionReason: z.string().min(1, "Rejection reason is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.rejectReport(input, ctx.appUser.id);
    }),
});

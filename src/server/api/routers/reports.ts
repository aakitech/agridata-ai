import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TriageService } from "~/server/modules/triage/triage-service";

export const reportsRouter = createTRPCRouter({
  // Get reports by status
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.enum(["PENDING_TRIAGE", "VERIFIED", "REJECTED"]).optional().default("PENDING_TRIAGE"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Pass orgId from authenticated user context
      const service = new TriageService(ctx.db, ctx.appUser.orgId);
      return service.getReportsByStatus(input.status);
    }),

  // Get a single report by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new TriageService(ctx.db, ctx.appUser.orgId);
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
      const service = new TriageService(ctx.db, ctx.appUser.orgId);
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
      const service = new TriageService(ctx.db, ctx.appUser.orgId);
      return service.rejectReport(input, ctx.appUser.id);
    }),
});

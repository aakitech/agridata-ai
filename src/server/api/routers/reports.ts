import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TriageService } from "~/server/modules/triage/triage-service";

export const reportsRouter = createTRPCRouter({
  // Get reports by status
  getAll: publicProcedure
    .input(
      z.object({
        status: z.enum(["PENDING_TRIAGE", "VERIFIED", "REJECTED"]).optional().default("PENDING_TRIAGE"),
      })
    )
    .query(async ({ ctx, input }) => {
      const service = new TriageService(ctx.db);
      return service.getReportsByStatus(input.status);
    }),

  // Get a single report by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new TriageService(ctx.db);
      return service.getReportById(input.id);
    }),

  // Verify a report
  verify: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        diagnosis: z.string().min(1, "Diagnosis is required"),
        riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new TriageService(ctx.db);
      return service.verifyReport(input);
    }),

  // Reject a report
  reject: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        rejectionReason: z.string().min(1, "Rejection reason is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = new TriageService(ctx.db);
      return service.rejectReport(input);
    }),
});

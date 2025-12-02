import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { reports } from "~/server/db/schema";

export const reportsRouter = createTRPCRouter({
  // Get all pending reports for triage
  getPending: publicProcedure.query(async ({ ctx }) => {
    const pendingReports = await ctx.db.query.reports.findMany({
      where: eq(reports.status, "PENDING_TRIAGE"),
      orderBy: (reports, { asc }) => [asc(reports.createdAt)],
      with: {
        user: true, // Now this works with the relations we defined!
      },
    });

    return pendingReports;
  }),

  // Get a single report by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.query.reports.findFirst({
        where: eq(reports.id, input.id),
      });

      if (!report) {
        throw new Error("Report not found");
      }

      return report;
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
      const [updated] = await ctx.db
        .update(reports)
        .set({
          status: "VERIFIED",
          diagnosis: input.diagnosis,
          riskLevel: input.riskLevel,
          verifiedAt: new Date(),
          // verifiedBy: ctx.session?.user?.id, // Add when auth is implemented
        })
        .where(eq(reports.id, input.id))
        .returning();

      return updated;
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
      const [updated] = await ctx.db
        .update(reports)
        .set({
          status: "REJECTED",
          rejectionReason: input.rejectionReason,
          verifiedAt: new Date(),
          // verifiedBy: ctx.session?.user?.id, // Add when auth is implemented
        })
        .where(eq(reports.id, input.id))
        .returning();

      return updated;
    }),
});

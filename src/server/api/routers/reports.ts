import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { reports } from "~/server/db/schema";

export const reportsRouter = createTRPCRouter({
  // Get all pending reports for triage
  getPending: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.reports.findMany({
      where: (reports, { eq }) => eq(reports.status, "PENDING_TRIAGE"),
      with: {
        user: true,
        media: true,
      },
      orderBy: (reports, { asc }) => [asc(reports.createdAt)],
    });
  }),

  // Get a single report by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.reports.findFirst({
        where: (reports, { eq }) => eq(reports.id, input.id),
        with: {
          user: true,
          media: true,
        },
      });
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

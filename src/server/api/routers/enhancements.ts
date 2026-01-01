import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { triageEnhancements, reports } from "~/server/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { canSoftTriage } from "~/lib/permissions";

export const enhancementsRouter = createTRPCRouter({
  /**
   * Create a new enhancement (soft triage annotation)
   * Accessible by: super_admin, org_admin
   * 
   * Enhancement types:
   * - quality: Photo issues (blurry, poor lighting, bad angle)
   * - context: Field conditions (weather, crop stage, growth)
   * - follow_up: Scout follow-up needed (better photo, verification)
   * - internal: Internal coordination notes (org-only visibility)
   */
  create: protectedProcedure
    .input(
      z.object({
        reportId: z.string().uuid(),
        enhancementType: z.enum(["label_hint", "quality", "context", "follow_up", "internal"]),
        enhancementText: z.string().min(1, "Enhancement text is required"),
        isInternal: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permission
      if (!canSoftTriage(ctx.appUser.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to add annotations",
        });
      }

      // Verify report exists and user has access
      const report = await ctx.db.query.reports.findFirst({
        where: eq(reports.id, input.reportId),
      });

      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      // Org admins can only annotate reports from their own organization
      if (ctx.appUser.role === "org_admin" && report.orgId !== ctx.appUser.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only annotate reports from your organization",
        });
      }

      // If enhancement type is "internal", force isInternal to true
      const isInternal = input.enhancementType === "internal" || input.isInternal;

      // Create enhancement
      const [enhancement] = await ctx.db
        .insert(triageEnhancements)
        .values({
          reportId: input.reportId,
          addedBy: ctx.appUser.id,
          enhancementType: input.enhancementType,
          enhancementText: input.enhancementText,
          isInternal,
        })
        .returning();

      // Update report enhancement tracking
      await ctx.db
        .update(reports)
        .set({
          enhancementCount: sql`${reports.enhancementCount} + 1`,
          lastEnhancementAt: new Date(),
        })
        .where(eq(reports.id, input.reportId));

      return enhancement;
    }),

  /**
   * Get all enhancements for a report with visibility filtering
   * - Super admins see all enhancements (including internal from all orgs)
   * - Org admins see all non-internal + internal from their own org
   */
  getByReportId: protectedProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Officers don't have dashboard access
      if (ctx.appUser.role === "officer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Officers do not have dashboard access",
        });
      }

      // First verify the user can access this report
      const report = await ctx.db.query.reports.findFirst({
        where: eq(reports.id, input.reportId),
      });

      if (!report) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      }

      // Org admins can only view reports from their org
      if (ctx.appUser.role === "org_admin" && report.orgId !== ctx.appUser.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only view reports from your organization",
        });
      }

      // Get enhancements with visibility filtering
      const enhancements = await ctx.db.query.triageEnhancements.findMany({
        where: eq(triageEnhancements.reportId, input.reportId),
        with: {
          addedByUser: {
            columns: {
              id: true,
              fullName: true,
              role: true,
              orgId: true,
            },
          },
        },
        orderBy: (te, { desc }) => [desc(te.createdAt)],
      });

      // Filter internal notes for org_admins (they can only see internal from same org)
      if (ctx.appUser.role === "org_admin") {
        return enhancements.filter((e) => {
          // Show all non-internal enhancements
          if (!e.isInternal) return true;
          // For internal enhancements, only show if from same org
          return e.addedByUser?.orgId === ctx.appUser.orgId;
        });
      }

      // Super admins see everything
      return enhancements;
    }),
});

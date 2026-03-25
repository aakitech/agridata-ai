import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TriageService } from "~/server/modules/triage/triage-service";
import { canHardTriage } from "~/lib/permissions";
import { ReportService } from "~/server/modules/reports/report-service";
import { MpbcReportPdfRenderer } from "~/server/modules/reports/mpbc-report-pdf-renderer";
import { getLastCompletedWeek, formatDateRange } from "~/server/modules/reports/report-utils";
import { organizations } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const reportsRouter = createTRPCRouter({
  // Get reports by status
  // Accessible by: super_admin (all orgs), org_admin (own org only)
  getAll: protectedProcedure
    .input(
      z.object({
        status: z.enum(["PENDING_TRIAGE", "VERIFIED", "REJECTED"]).optional().default("PENDING_TRIAGE"),
        filterOrgId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Officers cannot access triage dashboard
      if (ctx.appUser.role === "officer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Officers do not have dashboard access" });
      }
      
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getReportsByStatus(input.status, input.filterOrgId);
    }),

  // Get a single report by ID
  // Accessible by: super_admin (all orgs), org_admin (own org only)
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (ctx.appUser.role === "officer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Officers do not have dashboard access" });
      }
      
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.getReportById(input.id);
    }),

  // Verify a report (HARD TRIAGE - super_admin only)
  verify: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        diagnosis: z.string().min(1, "Diagnosis is required"),
        riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!canHardTriage(ctx.appUser.role)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Only expert reviewers can verify reports for training data" 
        });
      }
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.verifyReport(input, ctx.appUser.id);
    }),

  // Reject a report (HARD TRIAGE - super_admin only)
  reject: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        rejectionReason: z.string().min(1, "Rejection reason is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!canHardTriage(ctx.appUser.role)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Only expert reviewers can reject reports for training data" 
        });
      }
      const service = new TriageService(ctx.db, ctx.appUser.orgId, ctx.appUser.role);
      return service.rejectReport(input, ctx.appUser.id);
    }),

  // Reverse Geocode coordinates via Nominatim (Server-side to avoid CORS/rate-limits)
  reverseGeocode: protectedProcedure
    .input(z.object({ lat: z.number(), lon: z.number() }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${input.lat}&lon=${input.lon}`,
          {
            headers: {
              "User-Agent": "AgriDataAI/1.0 (contact@agridata.ai)",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch address from Nominatim");
        }

        const data = await response.json() as {
          address: {
            country?: string;
            state?: string;
            province?: string;
            suburb?: string;
            neighborhood?: string;
            city?: string;
            town?: string;
            village?: string;
            road?: string;
            county?: string;
          };
        };

        if (!data || !data.address) return null;

        return {
          country: data.address.country,
          state: data.address.state || data.address.province,
          suburb: data.address.suburb || data.address.neighborhood,
          city: data.address.city || data.address.town || data.address.village,
          neighborhood: data.address.neighborhood,
          town: data.address.town,
          village: data.address.village,
          road: data.address.road,
          county: data.address.county,
        };
      } catch (error) {
        console.error("Nominatim error:", error);
        return null;
      }
    }),

  // Generate MPBC Weekly Report (PDF)
  // Accessible by: org_admin (MPBC only), super_admin (any org, but must be MPBC)
  generateMpbcWeeklyReport: protectedProcedure
    .input(
      z
        .object({
          orgId: z.string().uuid().optional(), // Optional for super_admin
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      // Permission check: org_admin (own org) or super_admin (any org)
      if (ctx.appUser.role === "officer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Officers do not have access to report generation",
        });
      }

      // Determine orgId: super_admin can specify, org_admin uses their org
      const targetOrgId =
        ctx.appUser.role === "super_admin"
          ? input?.orgId ?? ctx.appUser.orgId
          : ctx.appUser.orgId;

      if (!targetOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization ID is required",
        });
      }

      // Verify org is MPBC (by slug "mpbc")
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, targetOrgId),
      });

      if (org?.slug !== "mpbc") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Report generation is only available for MPBC",
        });
      }

      // Calculate date range (use provided dates or default to last 7 days)
      const { startDate, endDate } =
        input?.startDate && input?.endDate
          ? { startDate: input.startDate, endDate: input.endDate }
          : getLastCompletedWeek();

      // Build report data
      const reportService = new ReportService(ctx.db);
      const reportData = await reportService.buildMpbcWeeklyReport(
        targetOrgId,
        startDate,
        endDate
      );

      // Generate PDF
      const renderer = new MpbcReportPdfRenderer();
      const pdfBuffer = await renderer.render(reportData);

      // Convert buffer to base64 for tRPC serialization
      const base64Pdf = Buffer.isBuffer(pdfBuffer)
        ? pdfBuffer.toString("base64")
        : Buffer.from(pdfBuffer).toString("base64");

      // Calculate period type for filename (Weekly for 7-day, Monthly for 30-day)
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const periodType = daysDiff <= 14 ? "Weekly" : "Monthly";

      // Return as base64 for tRPC serialization
      // Convert dates to ISO strings for proper serialization
      return {
        pdf: base64Pdf,
        filename: `MPBC_${periodType}_Pest_Surveillance_Report_${formatDateRange(startDate, endDate)}.pdf`,
        metadata: {
          organization: reportData.organization?.name ?? "MPBC",
          period: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          generatedAt: new Date().toISOString(),
        },
      };
    }),
});

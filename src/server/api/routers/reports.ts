import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TriageService } from "~/server/modules/triage/triage-service";
import { canHardTriage } from "~/lib/permissions";

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
          };
        };

        if (!data || !data.address) return null;

        return {
          country: data.address.country,
          state: data.address.state || data.address.province,
          suburb: data.address.suburb || data.address.neighborhood,
          city: data.address.city || data.address.town || data.address.village,
        };
      } catch (error) {
        console.error("Nominatim error:", error);
        return null;
      }
    }),
});

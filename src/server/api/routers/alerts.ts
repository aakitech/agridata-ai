import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { AlertsService } from "~/server/modules/alerts/alerts-service";

export const alertsRouter = createTRPCRouter({
  /**
   * Get all alert thresholds for an organization
   * - org_admin: returns own org thresholds (ignores input orgId)
   * - super_admin: requires orgId or returns empty
   */
  getOrgThresholds: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Officers cannot access alert settings
      if (ctx.appUser.role === "officer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Officers do not have access to alert settings",
        });
      }

      const service = new AlertsService(
        ctx.db,
        ctx.appUser.orgId,
        ctx.appUser.role
      );
      return service.getThresholds(input?.orgId);
    }),

  /**
   * Upsert (create or update) threshold for a pest
   * - org_admin: can only update own org (ignores input orgId)
   * - super_admin: can update any org (requires orgId)
   */
  upsertOrgThreshold: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid().optional(),
        pestKey: z.string().min(1, "Pest key is required"),
        normalMax: z.number().int().min(0),
        warningMax: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Officers cannot modify alert settings
      if (ctx.appUser.role === "officer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Officers do not have access to alert settings",
        });
      }

      const service = new AlertsService(
        ctx.db,
        ctx.appUser.orgId,
        ctx.appUser.role
      );

      try {
        return await service.upsertThreshold(input.orgId, input.pestKey, {
          normalMax: input.normalMax,
          warningMax: input.warningMax,
        });
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }
    }),
});




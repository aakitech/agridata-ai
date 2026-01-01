
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { organizations } from "~/server/db/schema";

export const organizationsRouter = createTRPCRouter({
  getAll: authProcedure.query(async ({ ctx }) => {
    // 🔒 CRITICAL SECURITY FIX: Require authentication for org access
    if (!ctx.appUser) {
      throw new TRPCError({ 
        code: "UNAUTHORIZED",
        message: "Authentication required to access organizations"
      });
    }
    
    // Only show user's own org unless super admin
    if (ctx.appUser.role !== "super_admin") {
      return ctx.db.query.organizations.findMany({
        where: (orgs, { eq }) => eq(orgs.id, ctx.appUser!.orgId),
        orderBy: (orgs, { asc }) => [asc(orgs.name)],
      });
    }

    // Super admins can see all organizations
    return ctx.db.query.organizations.findMany({
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
        if (ctx.appUser.role !== "super_admin") {
            throw new Error("Only super admins can create organizations");
        }

        const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

        return ctx.db.insert(organizations).values({
            name: input.name,
            slug,
        }).returning();
    }),
});

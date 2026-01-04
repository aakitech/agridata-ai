
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { organizations } from "~/server/db/schema";

export const organizationsRouter = createTRPCRouter({
  getAll: authProcedure.query(async ({ ctx }) => {
    // If user has a profile, and is not a super_admin, only return their own organization
    if (ctx.appUser && ctx.appUser.role !== "super_admin") {
      return ctx.db.query.organizations.findMany({
        where: (orgs, { eq }) => eq(orgs.id, ctx.appUser!.orgId),
        orderBy: (orgs, { asc }) => [asc(orgs.name)],
      });
    }

    // Otherwise (onboarding or super admin), return all organizations
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

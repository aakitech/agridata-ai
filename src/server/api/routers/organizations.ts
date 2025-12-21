
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { organizations } from "~/server/db/schema";

export const organizationsRouter = createTRPCRouter({
  getAll: authProcedure.query(async ({ ctx }) => {
    // Only allow if user is an admin? 
    // For now, let's allow all authenticated users to see orgs (for selection), 
    // or maybe restrict. 
    // Given the requirement is for "Super Admin" type flows, let's keep it simple.
    
    return ctx.db.query.organizations.findMany({
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
        if (ctx.appUser.role !== "admin") {
            throw new Error("Only admins can create organizations");
        }

        const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

        return ctx.db.insert(organizations).values({
            name: input.name,
            slug,
        }).returning();
    }),
});

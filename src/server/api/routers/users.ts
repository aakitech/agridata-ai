import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { appUsers, organizations } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

export const usersRouter = createTRPCRouter({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.appUsers.findFirst({
      where: eq(appUsers.authId, ctx.user.id),
      with: {
        organization: true,
      },
    });
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.appUser.role === "super_admin";

    return ctx.db.query.appUsers.findMany({
      where: isSuperAdmin 
        ? undefined // Show all users
        : eq(appUsers.orgId, ctx.appUser.orgId), // Show only own org
      with: {
        organization: true, // Include Organization details
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        phoneNumber: z.string().min(1),
        orgId: z.string().uuid().optional(), // New optional field
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Determine Target Org ID
      let targetOrgId = ctx.appUser.orgId;
      
      // If orgId is provided, check if user is allowed to set it
      if (input.orgId && input.orgId !== ctx.appUser.orgId) {
        if (ctx.appUser.role !== "super_admin") {
           throw new Error("Only super admins can add users to other organizations.");
        }
        targetOrgId = input.orgId;
      }
      
      // Format phone number
      let phone = input.phoneNumber.replace(/\s+/g, "").replace(/-/g, ""); // Remove spaces/dashes
      
      // Ensure specific prefix for bot compatibility if missing
      if (!phone.startsWith("whatsapp:")) {
         // If it starts with +, good. If not, maybe append +?
         // Optimistic assumption: User enters +263...
         if (!phone.startsWith("+")) {
             // Basic attempt to fix validation or throw error?
             // Let's assume input might be 077... -> requires country code.
             // For now, let's just prepend whatsapp: and trust valid input for now, 
             // but ideally we should validate E.164.
         }
         phone = `whatsapp:${phone}`;
      }

      // Check if user already exists
      const existingUser = await ctx.db.query.appUsers.findFirst({
        where: eq(appUsers.phoneNumber, phone),
      });

      if (existingUser) {
        throw new Error("User with this phone number already exists.");
      }
      
      const [user] = await ctx.db
        .insert(appUsers)
        .values({
          fullName: input.fullName,
          phoneNumber: phone,
          orgId: targetOrgId,
          role: "officer",
          isActive: true,
        })
        .returning();

      return user;
    }),

  onboard: authProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        orgId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure no profile exists yet
      const existing = await ctx.db.query.appUsers.findFirst({
        where: eq(appUsers.authId, ctx.user.id),
      });

      if (existing) {
        throw new Error("Profile already exists.");
      }

      const [user] = await ctx.db
        .insert(appUsers)
        .values({
          authId: ctx.user.id,
          fullName: input.fullName,
          orgId: input.orgId,
          role: "admin", // Default role for dashboard (web) users
          isActive: true,
        })
        .returning();

      return user;
    }),
});

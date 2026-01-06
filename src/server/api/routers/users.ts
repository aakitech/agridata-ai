import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
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
         // Optimistic assumption: User enters +263... (valid E.164)
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
        orgId: z.string().uuid().optional(), // Make optional
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 🔒 CRITICAL FIX: Check for existing PENDING profile from invite
      const existingProfile = await ctx.db.query.appUsers.findFirst({
        where: eq(appUsers.authId, ctx.user.id),
      });

      if (existingProfile) {
        if (existingProfile.status === "PENDING") {
          // ✅ ACTIVATE existing profile instead of error
          const [user] = await ctx.db
            .update(appUsers)
            .set({ 
              status: "ACTIVE",
              fullName: input.fullName || existingProfile.fullName
            })
            .where(eq(appUsers.authId, ctx.user.id))
            .returning();
          return user;
        }
        throw new Error("Profile already exists and is active.");
      }

      // 🔒 CRITICAL FIX: Only allow org creation, not joining existing orgs
      if (input.orgId) {
        throw new Error(
          "Invitation required to join existing organizations. " +
          "Please contact an administrator for an invitation."
        );
      }

      // Alternative: Create new organization (future enhancement)
      throw new Error(
        "Please contact an administrator to receive an invitation " +
        "to join an existing organization."
      );
    }),

  activate: protectedProcedure.mutation(async ({ ctx }) => {
    const [user] = await ctx.db
      .update(appUsers)
      .set({ status: "ACTIVE" })
      .where(eq(appUsers.authId, ctx.user.id))
      .returning();

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND", 
        message: "User profile not found"
      });
    }

    return user;
  }),
});
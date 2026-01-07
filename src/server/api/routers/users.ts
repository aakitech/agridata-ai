import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { appUsers, organizations, reports, botSessions, triageEnhancements } from "~/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        fullName: z.string().min(1).optional(),
        phoneNumber: z.string().min(1).optional(),
        orgId: z.string().uuid().optional(),
        role: z.enum(["super_admin", "org_admin", "officer"]).optional(),
        status: z.enum(["ACTIVE", "PENDING", "SUSPENDED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only Super Admin can update other users (for now, or Org Admin for their own org)
      // Simplification: Restricted to Super Admin as requested
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only super administrators can update user details.",
        });
      }

      const updates: Partial<typeof appUsers.$inferInsert> = {};
      if (input.fullName) updates.fullName = input.fullName;
      if (input.orgId) updates.orgId = input.orgId;
      if (input.role) updates.role = input.role;
      if (input.status) updates.status = input.status;

      if (input.phoneNumber) {
         let phone = input.phoneNumber.replace(/\s+/g, "").replace(/-/g, ""); 
         if (!phone.startsWith("whatsapp:")) {
            phone = `whatsapp:${phone}`;
         }
         
         // Check for conflict
         const existingUser = await ctx.db.query.appUsers.findFirst({
           where: and(
             eq(appUsers.phoneNumber, phone),
             sql`${appUsers.id} != ${input.id}`
           ),
         });
         
         if (existingUser) {
           throw new TRPCError({
             code: "CONFLICT",
             message: "Another user with this phone number already exists.",
           });
         }
         updates.phoneNumber = phone;
      }

      const [updatedUser] = await ctx.db
        .update(appUsers)
        .set(updates)
        .where(eq(appUsers.id, input.id))
        .returning();

      return updatedUser;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only super administrators can delete users.",
        });
      }

      // Check for related data
      const reportCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(eq(reports.userId, input.id))
        .then((res) => res[0]?.count ?? 0);

      const sessionCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(botSessions)
        .where(eq(botSessions.userId, input.id))
        .then((res) => res[0]?.count ?? 0);
        
      const enhancementCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(triageEnhancements)
        .where(eq(triageEnhancements.addedBy, input.id))
        .then((res) => res[0]?.count ?? 0);

      if (reportCount > 0 || sessionCount > 0 || enhancementCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete user: Found ${reportCount} reports, ${sessionCount} sessions, ${enhancementCount} triage actions. Please archive the user instead.`,
        });
      }

      await ctx.db.delete(appUsers).where(eq(appUsers.id, input.id));
      return { success: true };
    }),
});
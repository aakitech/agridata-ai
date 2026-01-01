import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { appUsers, organizations, userRoleEnum } from "~/server/db/schema";
import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";
import { eq } from "drizzle-orm";

export const invitesRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        orgId: z.string().uuid(),
        role: z.enum(userRoleEnum.enumValues),
        fullName: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Authorization & Scoping
      // If super_admin, can invite to any org.
      // If admin, can ONLY invite to own org.
      let targetOrgId = input.orgId;

if (ctx.appUser.role === "org_admin") {
         if (input.orgId !== ctx.appUser.orgId) {
             throw new TRPCError({
                 code: "FORBIDDEN",
                 message: "Org admins can only invite users to their own organization."
             });
         }
         
         // 🔒 CRITICAL SECURITY FIX: Block super_admin role assignment
         if (input.role === "super_admin") {
             throw new TRPCError({
                 code: "FORBIDDEN",
                 message: "Only super admins can assign super_admin role."
             });
         }
         
         targetOrgId = ctx.appUser.orgId;
       } else if (ctx.appUser.role !== "super_admin") {
         // Officers cannot invite
         throw new TRPCError({
             code: "FORBIDDEN",
             message: "Insufficient permissions to invite users."
         });
       }

      // 2. Initialize Supabase Admin Client
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Server misconfiguration: Missing service role key.",
        });
      }

      const supabaseAdmin = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY
      );

      console.log(`[Invites] Inviting ${input.email} to org ${targetOrgId} as ${input.role}`);

      // Redirect directly to the client-side accept-invite page to handle hash fragments
      const redirectUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/accept-invite`;
      
      let userId: string;
      let inviteLink: string | undefined;

      // 3. Pre-check if user exists and is confirmed
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users?.find(u => u.email === input.email);

      if (existingUser && existingUser.email_confirmed_at) {
         // User already confirmed, no need to invite (they should log in)
         throw new TRPCError({
             code: "BAD_REQUEST",
             message: "User is already registered and confirmed. They can log in directly."
         });
      }

      if (existingUser) {
          // User exists but not confirmed, use generateLink immediately (safer than re-inviting often)
          console.log("[Invites] User exists but unconfirmed, generating link directly...");
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "invite",
            email: input.email,
            options: { redirectTo: redirectUrl }
          });

          if (linkError) throw linkError;
          userId = linkData.user.id;
          inviteLink = linkData.properties.action_link;
      } else {
          // 4. Fresh Invite
          try {
            // Attempt standard invite (sends email)
            const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
                input.email,
                { redirectTo: redirectUrl }
            );

            if (inviteError) throw inviteError;
            userId = authData.user.id;
          } catch (err: any) {
              console.warn("[Invites] Standard invite failed, attempting fallback generation...", err.message);
              
              // Fallback: Generate Link manually
              const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email: input.email,
                options: { redirectTo: redirectUrl }
              });

              if (linkError) {
                 throw new TRPCError({
                     code: "BAD_REQUEST",
                     message: `Failed to invite user: ${linkError.message}`
                 });
              }

              userId = linkData.user.id;
              inviteLink = linkData.properties.action_link;
          }
      }

      // 4. Create Internal Profile (Pre-onboarding)
      try {
        await ctx.db.insert(appUsers).values({
          authId: userId,
          orgId: targetOrgId,
          role: input.role,
          fullName: input.fullName,
          email: input.email, // Cache email
          status: "PENDING",
          isActive: true,
        });
      } catch (dbError: any) {
        console.error("[Invites] DB Error:", dbError);
        // Clean up Auth user if DB fails? For now, throw error.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user profile.",
        });
      }

      return { success: true, userId, inviteLink };
    }),

  resend: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
        if (ctx.appUser.role !== "super_admin" && ctx.appUser.role !== "org_admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
        }

        if (!env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing service role key" });
        }

        const supabaseAdmin = createClient(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Ideally we check if user belongs to admin's org before resending
        // checking limits etc. For now we trust Supabase to handle rate limits/idempotency.
        
        // Redirect directly to the client-side accept-invite page to handle hash fragments
        const redirectUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/accept-invite`;

        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            input.email,
            { redirectTo: redirectUrl }
        ); // inviteUserByEmail is often used for resending invites too if user is unconfirmed

        if (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        
        return { success: true };
    }),
});

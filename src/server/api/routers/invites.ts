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
        email: z.string().email().optional(),
        phoneNumber: z.string().optional(),
        orgId: z.string().uuid(),
        role: z.enum(userRoleEnum.enumValues),
        fullName: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Authorization & Scoping
      let targetOrgId = input.orgId;

      if (input.role === "super_admin") {
         throw new TRPCError({
             code: "FORBIDDEN",
             message: "Super admin accounts must be managed separately."
         });
      }

      if (ctx.appUser.role === "org_admin") {
         if (input.orgId !== ctx.appUser.orgId) {
             throw new TRPCError({
                 code: "FORBIDDEN",
                 message: "Org admins can only invite users to their own organization."
             });
         }
         
         if (input.role !== "officer") {
             throw new TRPCError({
                 code: "FORBIDDEN",
                 message: "Org admins can only invite officers."
             });
         }
         
         targetOrgId = ctx.appUser.orgId;
       } else if (ctx.appUser.role !== "super_admin") {
         throw new TRPCError({
             code: "FORBIDDEN",
             message: "Insufficient permissions to invite users."
         });
       }

      // --- SPECIAL FLOW: FIELD OFFICERS (Phone Only) ---
      if (input.role === "officer") {
         if (!input.phoneNumber) {
             throw new TRPCError({
                 code: "BAD_REQUEST",
                 message: "Phone number is required for Field Officers."
             });
         }

         // Normalize phone number: trim and remove all whitespace
         const normalizedPhone = input.phoneNumber.trim().replace(/\s+/g, "");

         // Check if phone number is already registered
         const existingUser = await ctx.db.query.appUsers.findFirst({
             where: eq(appUsers.phoneNumber, normalizedPhone),
             with: {
                 organization: true
             }
         });

         if (existingUser) {
             const orgName = existingUser.organization?.name || "Unknown Organization";
             const isSameOrg = existingUser.orgId === targetOrgId;
             
             if (isSameOrg) {
                 throw new TRPCError({
                     code: "CONFLICT",
                     message: `This phone number is already registered in your organization as ${existingUser.fullName || "a field officer"}.`
                 });
             } else {
                 throw new TRPCError({
                     code: "CONFLICT",
                     message: `This phone number is already registered to ${existingUser.fullName || "a user"} in "${orgName}". A phone number can only belong to one organization.`
                 });
             }
         }

         // Direct DB Insert (No Auth User created yet)
         try {
             const [newUser] = await ctx.db.insert(appUsers).values({
               orgId: targetOrgId,
               role: input.role,
               fullName: input.fullName,
               phoneNumber: normalizedPhone, // Use normalized phone number
               email: input.email || null, // Optional for officers
               status: "ACTIVE", // Officers are active immediately for WhatsApp
               isActive: true,
             }).returning();

             if (!newUser) throw new Error("Failed to return new user");
             return { success: true, userId: newUser.id };
         } catch (dbError: any) {
             console.error("[Invites] DB Error:", dbError);
             throw new TRPCError({
                 code: "INTERNAL_SERVER_ERROR",
                 message: "Failed to create officer profile.",
             });
         }
      }

      // --- STANDARD FLOW: DASHBOARD USERS (Email + Supabase Auth) ---
      if (!input.email) {
          throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Email is required for Dashboard Users."
          });
      }

      // Check if email already exists in our database
      const existingAppUser = await ctx.db.query.appUsers.findFirst({
          where: eq(appUsers.email, input.email),
          with: {
              organization: true
          }
      });

      if (existingAppUser) {
          const orgName = existingAppUser.organization?.name || "Unknown Organization";
          const isSameOrg = existingAppUser.orgId === targetOrgId;
          
          if (isSameOrg) {
              throw new TRPCError({
                  code: "CONFLICT",
                  message: `This email is already registered in your organization as ${existingAppUser.fullName}.`
              });
          } else {
              throw new TRPCError({
                  code: "CONFLICT",
                  message: `This email is already registered to ${existingAppUser.fullName} in "${orgName}". An email can only belong to one organization.`
              });
          }
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
      
      const redirectUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=/accept-invite`;
      
      let userId: string;
      let inviteLink: string | undefined;

      // 3. Pre-check if user exists and is confirmed
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users?.find(u => u.email === input.email);

      if (existingUser && existingUser.email_confirmed_at) {
         throw new TRPCError({
             code: "BAD_REQUEST",
             message: "User is already registered and confirmed. They can log in directly."
         });
      }

      if (existingUser) {
          // User exists but unopened, regenerate link
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
            const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
                input.email,
                { redirectTo: redirectUrl }
            );

            if (inviteError) throw inviteError;
            userId = authData.user.id;
          } catch (err: any) {
              console.warn("[Invites] Standard invite failed, attempting fallback generation...", err.message);
              
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

      // 4. Create Internal Profile
      try {
        await ctx.db.insert(appUsers).values({
          authId: userId,
          orgId: targetOrgId,
          role: input.role,
          fullName: input.fullName,
          email: input.email, 
          status: "PENDING",
          isActive: true,
        });
      } catch (dbError: any) {
        console.error("[Invites] DB Error:", dbError);
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

        const existingAppUser = await ctx.db.query.appUsers.findFirst({
            where: eq(appUsers.email, input.email),
        });

        if (!existingAppUser) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "No pending profile found for this email.",
            });
        }

        if (ctx.appUser.role === "org_admin" && existingAppUser.orgId !== ctx.appUser.orgId) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Org admins can only resend invites for their own organization.",
            });
        }

        if (ctx.appUser.role === "org_admin" && existingAppUser.role !== "officer") {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Org admins can only resend officer invites.",
            });
        }

        if (existingAppUser.role === "super_admin") {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Super admin accounts must be managed separately.",
            });
        }

        if (existingAppUser.status !== "PENDING") {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Only pending invitations can be resent.",
            });
        }

        if (!env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing service role key" });
        }

        const supabaseAdmin = createClient(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Redirect directly to the client-side accept-invite page to handle hash fragments
        const redirectUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=/accept-invite`;

        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: listError.message });
        }

        const authUser = users?.find((user) => user.email === input.email);

        if (authUser?.email_confirmed_at) {
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: "recovery",
                email: input.email,
                options: { redirectTo: redirectUrl },
            });

            if (linkError) {
                throw new TRPCError({ code: "BAD_REQUEST", message: linkError.message });
            }

            return {
                success: true,
                inviteLink: linkData.properties.action_link,
                delivery: "manual_link" as const,
            };
        }
        
        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            input.email,
            { redirectTo: redirectUrl }
        );

        if (error) {
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email: input.email,
                options: { redirectTo: redirectUrl },
            });

            if (linkError) {
                throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
            }

            return {
                success: true,
                inviteLink: linkData.properties.action_link,
                delivery: "manual_link" as const,
            };
        }
        
        return { success: true, delivery: "email" as const };
    }),
});

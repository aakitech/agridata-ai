
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, authProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  appUsers,
  organizations,
  pestConfigurations,
} from "~/server/db/schema";
import { and, eq, sql } from "drizzle-orm";

const organizationStatusSchema = z.enum([
  "DRAFT",
  "CONFIGURING",
  "READY_FOR_TEST",
  "ACTIVE",
  "SUSPENDED",
]);

function toSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function buildReadiness(ctx: {
  db: typeof import("~/server/db").db;
}, orgId: string) {
  const org = await ctx.db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }

  const [orgAdminCount] = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(appUsers)
    .where(
      and(
        eq(appUsers.orgId, orgId),
        eq(appUsers.role, "org_admin"),
        eq(appUsers.status, "ACTIVE"),
        eq(appUsers.isActive, true)
      )
    );

  const [activeOfficerCount] = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(appUsers)
    .where(
      and(
        eq(appUsers.orgId, orgId),
        eq(appUsers.role, "officer"),
        eq(appUsers.status, "ACTIVE"),
        eq(appUsers.isActive, true)
      )
    );

  const activePestConfigs = await ctx.db.query.pestConfigurations.findMany({
    where: and(
      eq(pestConfigurations.orgId, orgId),
      eq(pestConfigurations.active, true)
    ),
    with: {
      observationConfigs: {
        with: {
          fields: true,
          severityRules: true,
        },
      },
    },
  });

  const hasConfiguredPestFlow = activePestConfigs.some((config) =>
    config.observationConfigs.some(
      (observationConfig) =>
        observationConfig.active &&
        observationConfig.fields.length > 0 &&
        observationConfig.severityRules.length > 0
    )
  );

  const checks = [
    {
      key: "org_admin",
      label: "At least one active org admin",
      ok: Number(orgAdminCount?.count ?? 0) > 0,
    },
    {
      key: "active_officer",
      label: "At least one active WhatsApp reporter",
      ok: Number(activeOfficerCount?.count ?? 0) > 0,
    },
    {
      key: "pest_config",
      label: "At least one active pest configuration",
      ok: activePestConfigs.length > 0,
    },
    {
      key: "configured_flow",
      label: "Pest flow has questions and severity rules",
      ok: hasConfiguredPestFlow,
    },
  ];

  const isOperationallyReady = checks.every((check) => check.ok);

  return {
    organization: org,
    counts: {
      orgAdmins: Number(orgAdminCount?.count ?? 0),
      activeOfficers: Number(activeOfficerCount?.count ?? 0),
      activePestConfigs: activePestConfigs.length,
    },
    checks,
    isOperationallyReady,
    recommendedStatus: isOperationallyReady ? "READY_FOR_TEST" : "CONFIGURING",
  };
}

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

        const slug = toSlug(input.name);
        if (!slug) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Organization name must contain letters or numbers",
          });
        }

        const existingOrg = await ctx.db.query.organizations.findFirst({
          where: eq(organizations.slug, slug),
        });

        if (existingOrg) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `An organization with slug "${slug}" already exists`,
          });
        }

        return ctx.db.insert(organizations).values({
            name: input.name,
            slug,
            status: "DRAFT",
        }).returning();
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: organizationStatusSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.appUser.role !== "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only super admins can update organization status",
        });
      }

      const [updated] = await ctx.db
        .update(organizations)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(organizations.id, input.id))
        .returning();

      return updated;
    }),

  getReadiness: protectedProcedure
    .input(
      z
        .object({
          orgId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const targetOrgId =
        ctx.appUser.role === "super_admin"
          ? input?.orgId
          : ctx.appUser.orgId;

      if (!targetOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization ID is required",
        });
      }

      return buildReadiness(ctx, targetOrgId);
    }),

  getAllReadiness: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.appUser.role !== "super_admin") {
      return [await buildReadiness(ctx, ctx.appUser.orgId)];
    }

    const orgs = await ctx.db.query.organizations.findMany({
      orderBy: (orgs, { asc }) => [asc(orgs.name)],
    });

    return Promise.all(orgs.map((org) => buildReadiness(ctx, org.id)));
  }),
});

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  pestConfigurations,
  pestObservationConfigs,
  pestObservationFields,
  pestSeverityRules,
} from "~/server/db/schema";

const fieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  helpText: z.string().nullable().optional(),
  fieldType: z.enum(["number", "select", "boolean", "text"]),
  required: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional().nullable(),
  options: z.array(z.string()).optional().nullable(),
  validationRules: z.record(z.string(), z.unknown()).optional().nullable(),
  captureMode: z.enum(["RAW", "CONTEXT"]).default("RAW"),
});

const severityRuleSchema = z.object({
  ruleOrder: z.number().int().default(0),
  severity: z.enum(["NORMAL", "WARNING", "HIGH"]),
  conditionKind: z.enum(["NUMERIC", "DERIVED", "CATEGORICAL", "DEFAULT"]),
  conditionExpression: z.record(z.string(), z.unknown()),
});

const observationConfigSchema = z.object({
  method: z.enum([
    "PHEROMONE_TRAP",
    "FIELD_OBSERVATION",
    "EVENT_OBSERVATION",
    "SIGN_BASED",
  ]),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  countFieldKey: z.string().nullable().optional(),
  summaryFieldKeys: z.array(z.string()).optional().nullable(),
  guidanceText: z.string().nullable().optional(),
  derivedDefinitions: z.record(z.string(), z.unknown()).optional().nullable(),
  confirmationNormalTemplate: z.string().nullable().optional(),
  confirmationWarningTemplate: z.string().nullable().optional(),
  confirmationHighTemplate: z.string().nullable().optional(),
  fields: z.array(fieldSchema),
  severityRules: z.array(severityRuleSchema),
});

const pestConfigSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  defaultObservationMethod: z.enum([
    "PHEROMONE_TRAP",
    "FIELD_OBSERVATION",
    "EVENT_OBSERVATION",
    "SIGN_BASED",
  ]),
  alertTrigger: z.enum(["WARNING_AND_HIGH", "HIGH_ONLY", "NONE"]),
  observationConfigs: z.array(observationConfigSchema).min(1),
});

function resolveTargetOrgId(
  role: "super_admin" | "org_admin" | "officer",
  appUserOrgId: string | null | undefined,
  inputOrgId?: string
) {
  if (role === "officer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Officers do not have access to pest configuration settings",
    });
  }

  if (role === "super_admin") {
    if (!inputOrgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "orgId is required for super admins",
      });
    }
    return inputOrgId;
  }

  if (!appUserOrgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization ID is required",
    });
  }

  return appUserOrgId;
}

export const pestConfigsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          orgId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const targetOrgId = resolveTargetOrgId(
        ctx.appUser.role,
        ctx.appUser.orgId,
        input?.orgId
      );

      return ctx.db.query.pestConfigurations.findMany({
        where: eq(pestConfigurations.orgId, targetOrgId),
        with: {
          observationConfigs: {
            with: {
              fields: true,
              severityRules: true,
            },
          },
        },
        orderBy: (table, { asc }) => [asc(table.displayOrder), asc(table.label)],
      });
    }),

  save: protectedProcedure
    .input(pestConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const targetOrgId = resolveTargetOrgId(
        ctx.appUser.role,
        ctx.appUser.orgId,
        input.orgId
      );

      return ctx.db.transaction(async (tx) => {
        let pestConfigId = input.id;

        if (pestConfigId) {
          const existing = await tx.query.pestConfigurations.findFirst({
            where: and(
              eq(pestConfigurations.id, pestConfigId),
              eq(pestConfigurations.orgId, targetOrgId)
            ),
          });

          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Pest configuration not found",
            });
          }

          await tx
            .update(pestConfigurations)
            .set({
              key: input.key,
              label: input.label,
              active: input.active,
              displayOrder: input.displayOrder,
              defaultObservationMethod: input.defaultObservationMethod,
              alertTrigger: input.alertTrigger,
              updatedAt: new Date(),
            })
            .where(eq(pestConfigurations.id, pestConfigId));

          const existingObservationConfigs = await tx.query.pestObservationConfigs.findMany({
            where: eq(pestObservationConfigs.pestConfigurationId, pestConfigId),
          });

          for (const config of existingObservationConfigs) {
            await tx
              .delete(pestObservationConfigs)
              .where(eq(pestObservationConfigs.id, config.id));
          }
        } else {
          const [created] = await tx
            .insert(pestConfigurations)
            .values({
              orgId: targetOrgId,
              key: input.key,
              label: input.label,
              active: input.active,
              displayOrder: input.displayOrder,
              defaultObservationMethod: input.defaultObservationMethod,
              alertTrigger: input.alertTrigger,
            })
            .returning({ id: pestConfigurations.id });

          pestConfigId = created!.id;
        }

        for (const config of input.observationConfigs) {
          const [createdObservationConfig] = await tx
            .insert(pestObservationConfigs)
            .values({
              pestConfigurationId: pestConfigId!,
              method: config.method,
              active: config.active,
              displayOrder: config.displayOrder,
              countFieldKey: config.countFieldKey ?? null,
              summaryFieldKeys: config.summaryFieldKeys ?? null,
              guidanceText: config.guidanceText ?? null,
              derivedDefinitions: config.derivedDefinitions ?? null,
              confirmationNormalTemplate: config.confirmationNormalTemplate ?? null,
              confirmationWarningTemplate: config.confirmationWarningTemplate ?? null,
              confirmationHighTemplate: config.confirmationHighTemplate ?? null,
            })
            .returning({ id: pestObservationConfigs.id });

          if (config.fields.length > 0) {
            await tx.insert(pestObservationFields).values(
              config.fields.map((field) => ({
                observationConfigId: createdObservationConfig!.id,
                key: field.key,
                label: field.label,
                prompt: field.prompt,
                helpText: field.helpText ?? null,
                fieldType: field.fieldType,
                required: field.required,
                displayOrder: field.displayOrder,
                defaultValue: field.defaultValue ?? null,
                options: field.options ?? null,
                validationRules: field.validationRules ?? null,
                captureMode: field.captureMode,
              }))
            );
          }

          if (config.severityRules.length > 0) {
            await tx.insert(pestSeverityRules).values(
              config.severityRules.map((rule) => ({
                observationConfigId: createdObservationConfig!.id,
                ruleOrder: rule.ruleOrder,
                severity: rule.severity,
                conditionKind: rule.conditionKind,
                conditionExpression: rule.conditionExpression,
              }))
            );
          }
        }

        return tx.query.pestConfigurations.findFirst({
          where: eq(pestConfigurations.id, pestConfigId!),
          with: {
            observationConfigs: {
              with: {
                fields: true,
                severityRules: true,
              },
            },
          },
        });
      });
    }),
});

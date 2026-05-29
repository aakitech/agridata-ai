import fs from "node:fs";
import path from "node:path";
import { and, eq, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  organizations,
  pestConfigurations,
  pestObservationConfigs,
  pestObservationFields,
  pestSeverityRules,
} from "../src/server/db/schema";

type Field = {
  key: string;
  label: string;
  prompt: string;
  fieldType: "number" | "select" | "boolean" | "text";
  displayOrder: number;
  required?: boolean;
  options?: string[];
  validationRules?: Record<string, unknown>;
};

type SeverityRule = {
  ruleOrder: number;
  severity: "NORMAL" | "WARNING" | "HIGH";
  conditionKind: "NUMERIC" | "DERIVED" | "CATEGORICAL" | "DEFAULT";
  conditionExpression: Record<string, unknown>;
};

type Pest = {
  key: string;
  label: string;
  displayOrder: number;
  summaryFieldKeys: string[];
  countFieldKey?: string;
  derivedDefinitions?: Record<string, unknown>;
  fields: Field[];
  severityRules: SeverityRule[];
};

const commonSugarcaneFields: Field[] = [
  {
    key: "estate_area",
    label: "Estate / area",
    prompt: "Which estate or area is this report from?",
    fieldType: "select",
    displayOrder: 1,
    options: [
      "Hippo Valley Estate",
      "Triangle Estate",
      "Mkwasine Estate",
      "Mwenezi / out-grower area",
      "Other",
    ],
  },
  {
    key: "estate_area_other",
    label: "Other estate / area",
    prompt: "Please type the estate or area name.",
    fieldType: "text",
    required: true,
    displayOrder: 2,
    validationRules: {
      showWhenField: "estate_area",
      showWhenEquals: "Other",
    },
  },
  {
    key: "section",
    label: "Section",
    prompt: "What is the section or sector name?",
    fieldType: "text",
    displayOrder: 3,
  },
  {
    key: "field_number",
    label: "Field number",
    prompt: "What is the field number?",
    fieldType: "text",
    displayOrder: 4,
  },
  {
    key: "farm_size_ha",
    label: "Farm size",
    prompt: "What is the farm size in hectares? Reply SKIP if unknown.",
    fieldType: "number",
    required: false,
    displayOrder: 5,
    validationRules: { min: 0 },
  },
  {
    key: "variety",
    label: "Variety",
    prompt: "What sugarcane variety is planted in this field?",
    fieldType: "text",
    displayOrder: 6,
  },
  {
    key: "crop_age_months",
    label: "Crop age",
    prompt: "What is the crop age in months?",
    fieldType: "number",
    displayOrder: 7,
    validationRules: { min: 0 },
  },
  {
    key: "irrigation_type",
    label: "Irrigation type",
    prompt: "What irrigation type is used in this field?",
    fieldType: "select",
    displayOrder: 8,
    options: ["Furrow", "Drip", "Overhead", "Flood", "Rainfed", "Other"],
  },
  {
    key: "irrigation_type_other",
    label: "Other irrigation type",
    prompt: "Please type the irrigation type.",
    fieldType: "text",
    required: true,
    displayOrder: 9,
    validationRules: {
      showWhenField: "irrigation_type",
      showWhenEquals: "Other",
    },
  },
  {
    key: "ratoon_number",
    label: "Ratoon number",
    prompt: "What is the ratoon number? Enter 0 for plant cane.",
    fieldType: "number",
    displayOrder: 10,
    validationRules: { min: 0, max: 20 },
  },
];

function withCommonFields(fields: Field[]): Field[] {
  return [
    ...commonSugarcaneFields,
    ...fields.map((field, index) => ({
      ...field,
      displayOrder: commonSugarcaneFields.length + index + 1,
    })),
  ];
}

const zsaesSugarcanePests: Pest[] = [
  {
    key: "eldana_saccharina",
    label: "Eldana saccharina",
    displayOrder: 1,
    countFieldKey: "internodes_bored",
    summaryFieldKeys: [
      "estate_area",
      "field_number",
      "stalks_bored",
      "internodes_bored",
      "eldana_present",
    ],
    derivedDefinitions: {
      stalk_bored_ratio: {
        formula: "ratio",
        numeratorField: "stalks_bored",
        denominatorField: "stalks_inspected",
      },
      internode_bored_ratio: {
        formula: "ratio",
        numeratorField: "internodes_bored",
        denominatorField: "internodes_inspected",
      },
    },
    fields: withCommonFields([
      {
        key: "stalks_inspected",
        label: "Stalks inspected",
        prompt: "How many stalks were inspected?",
        fieldType: "number",
        displayOrder: 1,
        validationRules: { min: 1 },
      },
      {
        key: "internodes_inspected",
        label: "Internodes inspected",
        prompt: "What is the total number of internodes inspected?",
        fieldType: "number",
        displayOrder: 2,
        validationRules: { min: 1 },
      },
      {
        key: "stalks_bored",
        label: "Stalks bored",
        prompt: "How many inspected stalks were bored?",
        fieldType: "number",
        displayOrder: 3,
        validationRules: { min: 0, maxFieldRef: "stalks_inspected" },
      },
      {
        key: "internodes_bored",
        label: "Internodes bored",
        prompt: "How many inspected internodes were bored?",
        fieldType: "number",
        displayOrder: 4,
        validationRules: { min: 0, maxFieldRef: "internodes_inspected" },
      },
      {
        key: "eldana_present",
        label: "Eldana present",
        prompt: "Was Eldana present in the sample?",
        fieldType: "select",
        displayOrder: 5,
        options: ["Yes", "No"],
      },
      {
        key: "eldana_count_per_stalk",
        label: "Eldana count per stalk",
        prompt: "Optional: enter Eldana count per stalk, or reply SKIP.",
        fieldType: "number",
        required: false,
        displayOrder: 6,
        validationRules: { min: 0 },
      },
    ]),
    severityRules: [
      {
        ruleOrder: 1,
        severity: "HIGH",
        conditionKind: "DERIVED",
        conditionExpression: {
          field: "internode_bored_ratio",
          operator: ">=",
          value: 0.1,
        },
      },
      {
        ruleOrder: 2,
        severity: "HIGH",
        conditionKind: "DERIVED",
        conditionExpression: {
          field: "stalk_bored_ratio",
          operator: ">=",
          value: 0.2,
        },
      },
      {
        ruleOrder: 3,
        severity: "WARNING",
        conditionKind: "DERIVED",
        conditionExpression: {
          field: "internode_bored_ratio",
          operator: ">=",
          value: 0.05,
        },
      },
      {
        ruleOrder: 4,
        severity: "WARNING",
        conditionKind: "DERIVED",
        conditionExpression: {
          field: "stalk_bored_ratio",
          operator: ">=",
          value: 0.1,
        },
      },
      {
        ruleOrder: 5,
        severity: "WARNING",
        conditionKind: "CATEGORICAL",
        conditionExpression: {
          field: "eldana_present",
          operator: "=",
          value: "Yes",
        },
      },
      {
        ruleOrder: 99,
        severity: "NORMAL",
        conditionKind: "DEFAULT",
        conditionExpression: { fallback: true },
      },
    ],
  },
  {
    key: "yellow_sugarcane_aphid",
    label: "Yellow Sugarcane Aphid",
    displayOrder: 2,
    summaryFieldKeys: [
      "estate_area",
      "field_number",
      "aphid_infestation_level",
      "plant_part_affected",
    ],
    fields: withCommonFields([
      {
        key: "aphid_infestation_level",
        label: "Aphid infestation level",
        prompt: "What is the aphid infestation level?",
        fieldType: "select",
        displayOrder: 1,
        options: ["None", "Low", "Moderate", "High"],
      },
      {
        key: "plant_part_affected",
        label: "Plant part affected",
        prompt: "Which plant part is affected?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Leaves", "Stalk", "Whole plant"],
      },
      {
        key: "honeydew_or_sooty_mould",
        label: "Honeydew or sooty mould",
        prompt: "Do you see honeydew or sooty mould?",
        fieldType: "select",
        displayOrder: 3,
        options: ["Yes", "No"],
      },
    ]),
    severityRules: [
      {
        ruleOrder: 1,
        severity: "HIGH",
        conditionKind: "CATEGORICAL",
        conditionExpression: {
          field: "aphid_infestation_level",
          operator: "=",
          value: "High",
        },
      },
      {
        ruleOrder: 2,
        severity: "WARNING",
        conditionKind: "CATEGORICAL",
        conditionExpression: {
          field: "aphid_infestation_level",
          operator: "=",
          value: "Moderate",
        },
      },
      {
        ruleOrder: 99,
        severity: "NORMAL",
        conditionKind: "DEFAULT",
        conditionExpression: { fallback: true },
      },
    ],
  },
  {
    key: "other_emerging_pest",
    label: "Other emerging pest",
    displayOrder: 3,
    summaryFieldKeys: [
      "estate_area",
      "field_number",
      "pest_or_symptom_description",
      "estimated_severity",
    ],
    fields: withCommonFields([
      {
        key: "pest_or_symptom_description",
        label: "Pest or symptom description",
        prompt: "Please describe the pest or symptoms observed.",
        fieldType: "text",
        displayOrder: 1,
      },
      {
        key: "estimated_severity",
        label: "Estimated severity",
        prompt: "What is the estimated severity?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Low", "Moderate", "High"],
      },
      {
        key: "additional_notes",
        label: "Additional notes",
        prompt: "Optional: add any extra notes, or reply SKIP.",
        fieldType: "text",
        required: false,
        displayOrder: 3,
      },
    ]),
    severityRules: [
      {
        ruleOrder: 1,
        severity: "HIGH",
        conditionKind: "CATEGORICAL",
        conditionExpression: {
          field: "estimated_severity",
          operator: "=",
          value: "High",
        },
      },
      {
        ruleOrder: 2,
        severity: "WARNING",
        conditionKind: "CATEGORICAL",
        conditionExpression: {
          field: "estimated_severity",
          operator: "=",
          value: "Moderate",
        },
      },
      {
        ruleOrder: 99,
        severity: "NORMAL",
        conditionKind: "DEFAULT",
        conditionExpression: { fallback: true },
      },
    ],
  },
];

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (!key || valueParts.length === 0) continue;
    if (process.env[key.trim()] !== undefined) continue;

    const rawValue = valueParts.join("=").trim();
    process.env[key.trim()] = rawValue.replace(/^["'](.*)["']$/, "$1");
  }
}

async function main() {
  loadLocalEnvFile();

  const refreshExisting =
    process.env.SEED_MODE === "refresh" || process.argv.includes("--refresh");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed ZSAES pest configs.");
  }

  const connection = postgres(databaseUrl);
  const db = drizzle(connection, {
    schema: {
      organizations,
      pestConfigurations,
      pestObservationConfigs,
      pestObservationFields,
      pestSeverityRules,
    },
  });

  let org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "zsaes"),
  });

  if (!org) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: "ZSAES",
        slug: "zsaes",
        status: "READY_FOR_TEST",
        activeWorkflow: null,
        workflowConfig: null,
      })
      .returning();
    org = created;
  } else {
    const [updated] = await db
      .update(organizations)
      .set({
        name: "ZSAES",
        status: org.status === "ACTIVE" ? "ACTIVE" : "READY_FOR_TEST",
        activeWorkflow: null,
        workflowConfig: null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id))
      .returning();
    org = updated;
  }

  if (!org) {
    throw new Error("Failed to create or load ZSAES organization.");
  }

  const activeDemoKeys = zsaesSugarcanePests.map((pest) => pest.key);
  let seededCount = 0;
  let updatedCount = 0;
  let deactivatedCount = 0;

  await db.transaction(async (tx) => {
    if (refreshExisting) {
      console.log("SEED_MODE=refresh detected. Clearing existing ZSAES pest configurations...");
      await tx
        .delete(pestConfigurations)
        .where(eq(pestConfigurations.orgId, org!.id));
    }

    if (!refreshExisting) {
      const deactivated = await tx
        .update(pestConfigurations)
        .set({ active: false, updatedAt: new Date() })
        .where(
          and(
            eq(pestConfigurations.orgId, org!.id),
            notInArray(pestConfigurations.key, activeDemoKeys)
          )
        )
        .returning();
      deactivatedCount = deactivated.length;
    }

    const existingConfigs = refreshExisting
      ? []
      : await tx.query.pestConfigurations.findMany({
          where: eq(pestConfigurations.orgId, org!.id),
        });
    const existingByKey = new Map(existingConfigs.map((config) => [config.key, config]));

    for (const pest of zsaesSugarcanePests) {
      const existingPestConfig = existingByKey.get(pest.key);

      const [pestConfig] = existingPestConfig
        ? await tx
            .update(pestConfigurations)
            .set({
              label: pest.label,
              active: true,
              displayOrder: pest.displayOrder,
              defaultObservationMethod: "FIELD_OBSERVATION",
              alertTrigger: "WARNING_AND_HIGH",
              updatedAt: new Date(),
            })
            .where(eq(pestConfigurations.id, existingPestConfig.id))
            .returning()
        : await tx
            .insert(pestConfigurations)
            .values({
              orgId: org!.id,
              key: pest.key,
              label: pest.label,
              active: true,
              displayOrder: pest.displayOrder,
              defaultObservationMethod: "FIELD_OBSERVATION",
              alertTrigger: "WARNING_AND_HIGH",
            })
            .returning();

      if (!pestConfig) {
        throw new Error(`Failed to create or update pest config ${pest.key}.`);
      }

      let observationConfig = await tx.query.pestObservationConfigs.findFirst({
        where: and(
          eq(pestObservationConfigs.pestConfigurationId, pestConfig.id),
          eq(pestObservationConfigs.method, "FIELD_OBSERVATION")
        ),
      });

      if (observationConfig) {
        const [updatedObservationConfig] = await tx
          .update(pestObservationConfigs)
          .set({
            active: true,
            displayOrder: 1,
            countFieldKey: pest.countFieldKey ?? null,
            summaryFieldKeys: pest.summaryFieldKeys,
            derivedDefinitions: pest.derivedDefinitions ?? null,
            guidanceText:
              "Draft ZSAES sugarcane pest surveillance demo flow v1. Refine after ZSAES confirms field lists, protocols, and thresholds.",
            updatedAt: new Date(),
          })
          .where(eq(pestObservationConfigs.id, observationConfig.id))
          .returning();
        observationConfig = updatedObservationConfig!;

        await tx
          .delete(pestObservationFields)
          .where(eq(pestObservationFields.observationConfigId, observationConfig.id));
        await tx
          .delete(pestSeverityRules)
          .where(eq(pestSeverityRules.observationConfigId, observationConfig.id));
      } else {
        const [createdObservationConfig] = await tx
          .insert(pestObservationConfigs)
          .values({
            pestConfigurationId: pestConfig.id,
            method: "FIELD_OBSERVATION",
            active: true,
            displayOrder: 1,
            countFieldKey: pest.countFieldKey ?? null,
            summaryFieldKeys: pest.summaryFieldKeys,
            derivedDefinitions: pest.derivedDefinitions ?? null,
            guidanceText:
              "Draft ZSAES sugarcane pest surveillance demo flow v1. Refine after ZSAES confirms field lists, protocols, and thresholds.",
          })
          .returning();
        observationConfig = createdObservationConfig!;
      }

      await tx.insert(pestObservationFields).values(
        pest.fields.map((field) => ({
          observationConfigId: observationConfig!.id,
          key: field.key,
          label: field.label,
          prompt: field.prompt,
          fieldType: field.fieldType,
          required: field.required ?? true,
          displayOrder: field.displayOrder,
          options: field.options ?? null,
          validationRules: field.validationRules ?? null,
          captureMode: "RAW",
        }))
      );

      await tx.insert(pestSeverityRules).values(
        pest.severityRules.map((rule) => ({
          observationConfigId: observationConfig!.id,
          ruleOrder: rule.ruleOrder,
          severity: rule.severity,
          conditionKind: rule.conditionKind,
          conditionExpression: rule.conditionExpression,
        }))
      );

      if (existingPestConfig) {
        updatedCount += 1;
        console.log(`Updated existing ZSAES pest config: ${pest.label} (${pest.key})`);
      } else {
        seededCount += 1;
        console.log(`Seeded ZSAES pest config: ${pest.label} (${pest.key})`);
      }
    }
  });

  console.log(`Seeded ${seededCount} ZSAES sugarcane pest configurations.`);
  console.log(`Updated ${updatedCount} existing ZSAES sugarcane pest configurations.`);
  console.log(`Deactivated ${deactivatedCount} non-demo ZSAES pest configurations.`);
  console.log(`Organization: ${org.name} (${org.id})`);
  await connection.end();
}

main().catch((error) => {
  console.error("Failed to seed ZSAES pest configs:", error);
  process.exit(1);
});

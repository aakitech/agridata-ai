import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
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
  options?: string[];
  validationRules?: Record<string, unknown>;
};

type Pest = {
  key: string;
  label: string;
  displayOrder: number;
  summaryFieldKeys: string[];
  fields: Field[];
  severityField: string;
  warningValue: string;
  highValue: string;
};

const placeholderPests: Pest[] = [
  {
    key: "aphids",
    label: "Aphids",
    displayOrder: 1,
    summaryFieldKeys: ["severity_level", "plant_area"],
    severityField: "severity_level",
    warningValue: "Moderate",
    highValue: "High",
    fields: [
      {
        key: "severity_level",
        label: "Aphid severity",
        prompt: "How severe is the aphid presence?",
        fieldType: "select",
        displayOrder: 1,
        options: ["Low", "Moderate", "High"],
      },
      {
        key: "plant_area",
        label: "Plant area",
        prompt: "Where did you observe the aphids?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Seedbed", "Field", "Both"],
      },
    ],
  },
  {
    key: "mealybug",
    label: "Mealybug",
    displayOrder: 2,
    summaryFieldKeys: ["severity_level", "visible_symptoms"],
    severityField: "severity_level",
    warningValue: "Moderate",
    highValue: "High",
    fields: [
      {
        key: "severity_level",
        label: "Mealybug severity",
        prompt: "How severe is the mealybug presence?",
        fieldType: "select",
        displayOrder: 1,
        options: ["Low", "Moderate", "High"],
      },
      {
        key: "visible_symptoms",
        label: "Visible symptoms",
        prompt: "What symptoms do you see?",
        fieldType: "select",
        displayOrder: 2,
        options: ["White bugs", "Honeydew", "Wilting", "Other"],
      },
    ],
  },
  {
    key: "budworm",
    label: "Budworm",
    displayOrder: 3,
    summaryFieldKeys: ["damage_level", "plant_part"],
    severityField: "damage_level",
    warningValue: "Moderate",
    highValue: "Severe",
    fields: [
      {
        key: "damage_level",
        label: "Damage level",
        prompt: "How much crop damage do you see?",
        fieldType: "select",
        displayOrder: 1,
        options: ["Light", "Moderate", "Severe"],
      },
      {
        key: "plant_part",
        label: "Affected plant part",
        prompt: "Which part of the plant is affected?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Leaves", "Buds", "Stems", "Multiple parts"],
      },
    ],
  },
  {
    key: "falsewire_worm",
    label: "Falsewire worm",
    displayOrder: 4,
    summaryFieldKeys: ["damage_level", "where_observed"],
    severityField: "damage_level",
    warningValue: "Moderate",
    highValue: "Severe",
    fields: [
      {
        key: "damage_level",
        label: "Damage level",
        prompt: "How much crop damage do you see?",
        fieldType: "select",
        displayOrder: 1,
        options: ["Light", "Moderate", "Severe"],
      },
      {
        key: "where_observed",
        label: "Where observed",
        prompt: "Where did you observe the falsewire worm or damage?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Seedbed", "Field", "Soil", "Other"],
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

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed Kutsaga placeholder configs.");
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
    where: eq(organizations.slug, "kutsaga"),
  });

  if (!org) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: "Kutsaga Research Board",
        slug: "kutsaga",
        status: "CONFIGURING",
      })
      .returning();
    org = created;
  }

  if (!org) {
    throw new Error("Failed to create or load Kutsaga organization.");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(pestConfigurations)
      .where(eq(pestConfigurations.orgId, org!.id));

    for (const pest of placeholderPests) {
      const [pestConfig] = await tx
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

      const [observationConfig] = await tx
        .insert(pestObservationConfigs)
        .values({
          pestConfigurationId: pestConfig!.id,
          method: "FIELD_OBSERVATION",
          active: true,
          displayOrder: 1,
          summaryFieldKeys: pest.summaryFieldKeys,
          guidanceText: "Placeholder Kutsaga farmer pilot flow. Replace after stakeholder review.",
        })
        .returning();

      await tx.insert(pestObservationFields).values(
        pest.fields.map((field) => ({
          observationConfigId: observationConfig!.id,
          key: field.key,
          label: field.label,
          prompt: field.prompt,
          fieldType: field.fieldType,
          required: true,
          displayOrder: field.displayOrder,
          options: field.options ?? null,
          validationRules: field.validationRules ?? null,
          captureMode: "RAW",
        }))
      );

      await tx.insert(pestSeverityRules).values([
        {
          observationConfigId: observationConfig!.id,
          ruleOrder: 1,
          severity: "HIGH",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: pest.severityField,
            operator: "=",
            value: pest.highValue,
          },
        },
        {
          observationConfigId: observationConfig!.id,
          ruleOrder: 2,
          severity: "WARNING",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: pest.severityField,
            operator: "=",
            value: pest.warningValue,
          },
        },
        {
          observationConfigId: observationConfig!.id,
          ruleOrder: 99,
          severity: "NORMAL",
          conditionKind: "DEFAULT",
          conditionExpression: { fallback: true },
        },
      ]);
    }
  });

  console.log(`Seeded ${placeholderPests.length} placeholder Kutsaga pest configurations.`);
  console.log(`Organization: ${org.name} (${org.id})`);
  await connection.end();
}

main().catch((error) => {
  console.error("Failed to seed Kutsaga placeholder configs:", error);
  process.exit(1);
});

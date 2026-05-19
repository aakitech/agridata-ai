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
  warningValues: string[];
  highValues: string[];
};

const kutsagaTobaccoPilotPests: Pest[] = [
  {
    key: "aphids",
    label: "Aphids",
    displayOrder: 1,
    summaryFieldKeys: ["aphid_rating", "plant_area", "sooty_mould_seen"],
    severityField: "aphid_rating",
    warningValues: ["11 — 100 aphids"],
    highValues: ["101 — 1000 aphids", "More than 1000 aphids"],
    fields: [
      {
        key: "aphid_rating",
        label: "Aphid count rating",
        prompt: "How many aphids can you see on the leaves?",
        fieldType: "select",
        displayOrder: 1,
        options: [
          "No aphids",
          "1 — 10 aphids",
          "11 — 100 aphids",
          "101 — 1000 aphids",
          "More than 1000 aphids",
        ],
      },
      {
        key: "plant_area",
        label: "Plant area",
        prompt: "Where did you see the aphids?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Seedbed", "Field", "Both"],
      },
      {
        key: "sooty_mould_seen",
        label: "Sooty mould",
        prompt: "Do you see black sooty mould on the leaves?",
        fieldType: "select",
        displayOrder: 3,
        options: ["Yes", "No"],
      },
    ],
  },
  {
    key: "mealybug",
    label: "Mealybug",
    displayOrder: 2,
    summaryFieldKeys: ["mealybug_rating", "plant_area", "sooty_mould_seen"],
    severityField: "mealybug_rating",
    warningValues: ["11 — 50 mealybugs"],
    highValues: ["51 — 100 mealybugs", "More than 100 mealybugs"],
    fields: [
      {
        key: "mealybug_rating",
        label: "Mealybug infestation rating",
        prompt: "How many mealybugs can you see?",
        fieldType: "select",
        displayOrder: 1,
        options: [
          "No mealybugs",
          "1 — 10 mealybugs",
          "11 — 50 mealybugs",
          "51 — 100 mealybugs",
          "More than 100 mealybugs",
        ],
      },
      {
        key: "plant_area",
        label: "Plant area",
        prompt: "Where did you see the mealybugs?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Seedbed", "Field", "Both"],
      },
      {
        key: "sooty_mould_seen",
        label: "Sooty mould",
        prompt: "Do you see black sooty mould on the leaves?",
        fieldType: "select",
        displayOrder: 3,
        options: ["Yes", "No"],
      },
    ],
  },
  {
    key: "budworm",
    label: "Budworm",
    displayOrder: 3,
    summaryFieldKeys: ["budworm_damage_rating", "larvae_seen"],
    severityField: "budworm_damage_rating",
    warningValues: [
      "25% — 50% of leaves around the bud are damaged",
      "51% — 75% of leaves around the bud are damaged",
    ],
    highValues: [
      "76% — 100% of leaves around the bud are damaged",
      "The bud is completely damaged",
    ],
    fields: [
      {
        key: "budworm_damage_rating",
        label: "Budworm damage rating",
        prompt: "How much damage do you see around the bud?",
        fieldType: "select",
        displayOrder: 1,
        options: [
          "No damage",
          "Less than 25% of leaves around the bud are damaged",
          "25% — 50% of leaves around the bud are damaged",
          "51% — 75% of leaves around the bud are damaged",
          "76% — 100% of leaves around the bud are damaged",
          "The bud is completely damaged",
        ],
      },
      {
        key: "larvae_seen",
        label: "Larvae seen",
        prompt: "Did you see budworm worms on the plant?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Yes", "No"],
      },
    ],
  },
  {
    key: "falsewire_worm",
    label: "False wireworm",
    displayOrder: 4,
    summaryFieldKeys: ["stem_damage_rating", "worms_seen"],
    severityField: "stem_damage_rating",
    warningValues: ["About half of the stem is damaged"],
    highValues: [
      "Most of the stem is damaged",
      "The stem is damaged all the way around",
    ],
    fields: [
      {
        key: "stem_damage_rating",
        label: "False wireworm stem damage rating",
        prompt: "How much stem damage do you see?",
        fieldType: "select",
        displayOrder: 1,
        options: [
          "No stem damage",
          "A small part of the stem is damaged",
          "About half of the stem is damaged",
          "Most of the stem is damaged",
          "The stem is damaged all the way around",
        ],
      },
      {
        key: "worms_seen",
        label: "Worms seen",
        prompt: "Did you see false wireworms in the soil or near the roots?",
        fieldType: "select",
        displayOrder: 2,
        options: ["Yes", "No"],
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
    throw new Error("DATABASE_URL is required to seed Kutsaga tobacco pilot configs.");
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

  let seededCount = 0;
  let skippedCount = 0;

  await db.transaction(async (tx) => {
    if (refreshExisting) {
      console.log("SEED_MODE=refresh detected. Clearing existing Kutsaga pest configurations...");
      await tx
        .delete(pestConfigurations)
        .where(eq(pestConfigurations.orgId, org!.id));
    }

    const existingConfigs = refreshExisting
      ? []
      : await tx.query.pestConfigurations.findMany({
          where: eq(pestConfigurations.orgId, org!.id),
        });
    const existingKeys = new Set(existingConfigs.map((config) => config.key));

    for (const pest of kutsagaTobaccoPilotPests) {
      if (existingKeys.has(pest.key)) {
        console.log(`Skipping existing Kutsaga pest config: ${pest.label} (${pest.key})`);
        skippedCount += 1;
        continue;
      }

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
          guidanceText: "Draft Kutsaga tobacco farmer pilot flow v1. Refine after Kutsaga confirms count ranges, symptoms, and reference photos.",
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
        ...pest.highValues.map((value, index) => ({
          observationConfigId: observationConfig!.id,
          ruleOrder: index + 1,
          severity: "HIGH" as const,
          conditionKind: "CATEGORICAL" as const,
          conditionExpression: {
            field: pest.severityField,
            operator: "=",
            value,
          },
        })),
        ...pest.warningValues.map((value, index) => ({
          observationConfigId: observationConfig!.id,
          ruleOrder: pest.highValues.length + index + 1,
          severity: "WARNING" as const,
          conditionKind: "CATEGORICAL" as const,
          conditionExpression: {
            field: pest.severityField,
            operator: "=",
            value,
          },
        })),
        {
          observationConfigId: observationConfig!.id,
          ruleOrder: 99,
          severity: "NORMAL",
          conditionKind: "DEFAULT",
          conditionExpression: { fallback: true },
        },
      ]);

      seededCount += 1;
    }
  });

  console.log(`Seeded ${seededCount} draft Kutsaga tobacco pilot pest configurations.`);
  console.log(`Skipped ${skippedCount} existing Kutsaga pest configurations.`);
  if (!refreshExisting && skippedCount > 0) {
    console.log("Existing configs were not changed. Use --refresh or SEED_MODE=refresh to intentionally recreate them.");
  }
  console.log(`Organization: ${org.name} (${org.id})`);
  await connection.end();
}

main().catch((error) => {
  console.error("Failed to seed Kutsaga tobacco pilot configs:", error);
  process.exit(1);
});

import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import {
  organizations,
  pestConfigurations,
  pestObservationConfigs,
  pestObservationFields,
  pestSeverityRules,
} from "../src/server/db/schema";

type SeedField = {
  key: string;
  label: string;
  prompt: string;
  fieldType: "number" | "select" | "boolean" | "text";
  required?: boolean;
  displayOrder: number;
  helpText?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
  captureMode?: "RAW" | "CONTEXT";
  validationRules?: Record<string, unknown>;
};

type SeedRule = {
  ruleOrder: number;
  severity: "NORMAL" | "WARNING" | "HIGH";
  conditionKind: "NUMERIC" | "DERIVED" | "CATEGORICAL" | "DEFAULT";
  conditionExpression: Record<string, unknown>;
};

type SeedPest = {
  key: string;
  label: string;
  displayOrder: number;
  defaultObservationMethod:
    | "PHEROMONE_TRAP"
    | "FIELD_OBSERVATION"
    | "EVENT_OBSERVATION"
    | "SIGN_BASED";
  alertTrigger: "WARNING_AND_HIGH" | "HIGH_ONLY" | "NONE";
  observationConfig: {
    method: "PHEROMONE_TRAP" | "FIELD_OBSERVATION" | "EVENT_OBSERVATION" | "SIGN_BASED";
    displayOrder: number;
    countFieldKey?: string;
    summaryFieldKeys?: string[];
    guidanceText?: string;
    derivedDefinitions?: Record<string, unknown>;
    fields: SeedField[];
    severityRules: SeedRule[];
  };
};

const phaseOnePests: SeedPest[] = [
  {
    key: "african_armyworm",
    label: "African Armyworm",
    displayOrder: 1,
    defaultObservationMethod: "PHEROMONE_TRAP",
    alertTrigger: "WARNING_AND_HIGH",
    observationConfig: {
      method: "PHEROMONE_TRAP",
      displayOrder: 1,
      countFieldKey: "moth_count",
      summaryFieldKeys: ["moth_count"],
      guidanceText: "Record the number of moths caught in the pheromone trap.",
      fields: [
        {
          key: "moth_count",
          label: "Moth count",
          prompt: "How many moths were caught in the trap?",
          fieldType: "number",
          required: true,
          displayOrder: 1,
          validationRules: { min: 0 },
        },
      ],
      severityRules: [
        {
          ruleOrder: 1,
          severity: "HIGH",
          conditionKind: "NUMERIC",
          conditionExpression: { field: "moth_count", operator: ">", value: 20 },
        },
        {
          ruleOrder: 2,
          severity: "WARNING",
          conditionKind: "NUMERIC",
          conditionExpression: { field: "moth_count", operator: ">", value: 15 },
        },
        {
          ruleOrder: 99,
          severity: "NORMAL",
          conditionKind: "DEFAULT",
          conditionExpression: { fallback: true },
        },
      ],
    },
  },
  {
    key: "locusts",
    label: "Locusts",
    displayOrder: 2,
    defaultObservationMethod: "EVENT_OBSERVATION",
    alertTrigger: "HIGH_ONLY",
    observationConfig: {
      method: "EVENT_OBSERVATION",
      displayOrder: 1,
      summaryFieldKeys: ["event_scale", "movement_direction", "behavior"],
      guidanceText: "Capture what officers observe about the locust event, not an interpreted risk label.",
      fields: [
        {
          key: "event_scale",
          label: "Event scale",
          prompt: "How large was the locust event?",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [
            "1-10 (individuals, easy to count)",
            "10-100 (small group, visible cluster)",
            "100-1000 (large swarm covering part of field)",
            "More than 1000 (dense swarm, hard to see ground clearly)",
          ],
        },
        {
          key: "movement_direction",
          label: "Movement direction",
          prompt: "Which direction were the locusts moving?",
          fieldType: "select",
          required: true,
          displayOrder: 2,
          options: [
            "North",
            "North-East",
            "East",
            "South-East",
            "South",
            "South-West",
            "West",
            "North-West",
          ],
        },
        {
          key: "behavior",
          label: "Behavior",
          prompt: "What were the locusts doing?",
          fieldType: "select",
          required: true,
          displayOrder: 3,
          options: ["Feeding", "Resting", "Flying"],
        },
      ],
      severityRules: [
        {
          ruleOrder: 1,
          severity: "HIGH",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: "event_scale",
            operator: "=",
            value: "More than 1000 (dense swarm, hard to see ground clearly)",
          },
        },
        {
          ruleOrder: 2,
          severity: "WARNING",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: "event_scale",
            operator: "=",
            value: "100-1000 (large swarm covering part of field)",
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
  },
  {
    key: "quelea_birds",
    label: "Quelea Birds",
    displayOrder: 3,
    defaultObservationMethod: "EVENT_OBSERVATION",
    alertTrigger: "HIGH_ONLY",
    observationConfig: {
      method: "EVENT_OBSERVATION",
      displayOrder: 1,
      summaryFieldKeys: ["flock_size_band", "behavior", "crop_stage"],
      guidanceText: "Capture observed flock size, bird behavior, crop type, and crop stage.",
      fields: [
        {
          key: "flock_size_band",
          label: "Flock size",
          prompt: "What was the estimated flock size?",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [
            "Under 500 (scattered birds, countable groups)",
            "500 - 5000 (large flock covering trees/field section)",
            "5000 - 20000 (very large flock, continuous movement)",
            "More than 20000 (dense cloud, sky appears darkened)",
          ],
        },
        {
          key: "behavior",
          label: "Bird behavior",
          prompt: "What were the birds doing?",
          fieldType: "select",
          required: true,
          displayOrder: 2,
          options: ["Feeding", "Roosting", "Flying"],
        },
        {
          key: "crop_stage",
          label: "Crop stage",
          prompt: "What is the crop growth stage?",
          fieldType: "select",
          required: true,
          displayOrder: 3,
          options: ["Seedling", "Vegetative", "Flowering", "Mature"],
        },
      ],
      severityRules: [
        {
          ruleOrder: 1,
          severity: "HIGH",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: "flock_size_band",
            operator: "=",
            value: "More than 20000 (dense cloud, sky appears darkened)",
          },
        },
        {
          ruleOrder: 2,
          severity: "WARNING",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: "flock_size_band",
            operator: "=",
            value: "5000 - 20000 (very large flock, continuous movement)",
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
  },
  {
    key: "rodents",
    label: "Rodents",
    displayOrder: 4,
    defaultObservationMethod: "SIGN_BASED",
    alertTrigger: "WARNING_AND_HIGH",
    observationConfig: {
      method: "SIGN_BASED",
      displayOrder: 1,
      summaryFieldKeys: ["activity_level", "trend", "damage_type"],
      guidanceText: "Record the level of rodent activity, signs, and trend over time.",
      fields: [
        {
          key: "activity_level",
          label: "Activity level",
          prompt: "What level of rodent activity was observed?",
          fieldType: "select",
          required: true,
          displayOrder: 1,
          options: [
            "Low (few signs, isolated)",
            "Moderate (regular signs across field)",
            "High (widespread damage, multiple signs in many areas)",
          ],
        },
        {
          key: "trend",
          label: "Trend",
          prompt: "Compared to recent observations, is rodent activity increasing, stable, or decreasing?",
          fieldType: "select",
          required: true,
          displayOrder: 2,
          options: ["Increasing", "Stable", "Decreasing"],
        },
        {
          key: "damage_type",
          label: "Damage type",
          prompt: "What type of rodent damage or sign was observed?",
          fieldType: "select",
          required: true,
          displayOrder: 3,
          options: [
            "Gnawed crops",
            "Burrows / holes",
            "Droppings",
            "Tracks / footprints",
            "Cut stems",
            "Stored grain damage",
            "Other",
          ],
        },
        {
          key: "damage_type_other",
          label: "Other damage type",
          prompt: "Please describe the other rodent damage or sign observed.",
          fieldType: "text",
          required: true,
          displayOrder: 4,
          validationRules: {
            showWhenField: "damage_type",
            showWhenEquals: "Other",
          },
        },
      ],
      severityRules: [
        {
          ruleOrder: 1,
          severity: "HIGH",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: "activity_level",
            operator: "=",
            value: "High (widespread damage, multiple signs in many areas)",
          },
        },
        {
          ruleOrder: 2,
          severity: "WARNING",
          conditionKind: "CATEGORICAL",
          conditionExpression: {
            field: "activity_level",
            operator: "=",
            value: "Moderate (regular signs across field)",
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
  },
  {
    key: "fall_armyworm",
    label: "Fall Armyworm",
    displayOrder: 5,
    defaultObservationMethod: "PHEROMONE_TRAP",
    alertTrigger: "HIGH_ONLY",
    observationConfig: {
      method: "PHEROMONE_TRAP",
      displayOrder: 1,
      countFieldKey: "adult_insect_count",
      summaryFieldKeys: ["adult_insect_count"],
      guidanceText: "Record the number of adult Fall Armyworm insects caught in the trap.",
      fields: [
        {
          key: "adult_insect_count",
          label: "Adult insect count",
          prompt: "How many adult insects were caught in the trap?",
          fieldType: "number",
          required: true,
          displayOrder: 1,
          validationRules: { min: 0 },
        },
      ],
      severityRules: [
        {
          ruleOrder: 1,
          severity: "HIGH",
          conditionKind: "NUMERIC",
          conditionExpression: { field: "adult_insect_count", operator: ">", value: 20 },
        },
        {
          ruleOrder: 2,
          severity: "WARNING",
          conditionKind: "NUMERIC",
          conditionExpression: { field: "adult_insect_count", operator: ">", value: 5 },
        },
        {
          ruleOrder: 99,
          severity: "NORMAL",
          conditionKind: "DEFAULT",
          conditionExpression: { fallback: true },
        },
      ],
    },
  },
];

async function main() {
  console.log("Seeding MPBC pest configurations...");

  const mpbcOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, "mpbc"),
  });

  if (!mpbcOrg) {
    console.error("Organization 'mpbc' was not found. Create or seed the MPBC organization first.");
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(pestConfigurations)
      .where(eq(pestConfigurations.orgId, mpbcOrg.id));

    for (const pest of phaseOnePests) {
      const [pestConfig] = await tx
        .insert(pestConfigurations)
        .values({
          orgId: mpbcOrg.id,
          key: pest.key,
          label: pest.label,
          active: true,
          displayOrder: pest.displayOrder,
          defaultObservationMethod: pest.defaultObservationMethod,
          alertTrigger: pest.alertTrigger,
        })
        .returning();

      const [observationConfig] = await tx
        .insert(pestObservationConfigs)
        .values({
          pestConfigurationId: pestConfig!.id,
          method: pest.observationConfig.method,
          active: true,
          displayOrder: pest.observationConfig.displayOrder,
          countFieldKey: pest.observationConfig.countFieldKey ?? null,
          summaryFieldKeys: pest.observationConfig.summaryFieldKeys ?? null,
          guidanceText: pest.observationConfig.guidanceText ?? null,
          derivedDefinitions: pest.observationConfig.derivedDefinitions ?? null,
        })
        .returning();

      if (pest.observationConfig.fields.length > 0) {
        await tx.insert(pestObservationFields).values(
          pest.observationConfig.fields.map((field) => ({
            observationConfigId: observationConfig!.id,
            key: field.key,
            label: field.label,
            prompt: field.prompt,
            helpText: field.helpText ?? null,
            fieldType: field.fieldType,
            required: field.required ?? true,
            displayOrder: field.displayOrder,
            defaultValue: field.defaultValue ?? null,
            options: field.options ?? null,
            validationRules: field.validationRules ?? null,
            captureMode: field.captureMode ?? "RAW",
          }))
        );
      }

      if (pest.observationConfig.severityRules.length > 0) {
        await tx.insert(pestSeverityRules).values(
          pest.observationConfig.severityRules.map((rule) => ({
            observationConfigId: observationConfig!.id,
            ruleOrder: rule.ruleOrder,
            severity: rule.severity,
            conditionKind: rule.conditionKind,
            conditionExpression: rule.conditionExpression,
          }))
        );
      }
    }
  });

  console.log(`Seeded ${phaseOnePests.length} MPBC pest configurations.`);
}

main().catch((error) => {
  console.error("Failed to seed MPBC pest configurations:", error);
  process.exit(1);
});

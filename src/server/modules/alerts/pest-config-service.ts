import { and, eq, or } from "drizzle-orm";
import { db } from "~/server/db";
import type { Severity } from "./alerts-service";
import { pestConfigurations } from "~/server/db/schema";

export type ObservationMethod =
  | "PHEROMONE_TRAP"
  | "FIELD_OBSERVATION"
  | "EVENT_OBSERVATION"
  | "SIGN_BASED";

export type AlertTrigger = "WARNING_AND_HIGH" | "HIGH_ONLY" | "NONE";

export type PestConfigRecord = Awaited<ReturnType<PestConfigService["getPestConfig"]>>;

export interface PestAssessmentInput {
  orgId: string;
  pestKey: string;
  observationMethod?: ObservationMethod | null;
  raw: Record<string, unknown>;
}

export interface PestAssessmentResult {
  pestConfigurationId: string;
  pestKey: string;
  pestLabel: string;
  observationMethod: ObservationMethod;
  observedCount: number | null;
  derived: Record<string, unknown>;
  severity: Severity;
  alertTriggered: boolean;
  alertTriggerReason: string;
}

function toLookupCandidates(value: string): string[] {
  const trimmed = value.trim();
  const snake = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return Array.from(new Set([trimmed, trimmed.toLowerCase(), snake])).filter(Boolean);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function compareValues(left: unknown, operator: string, right: unknown): boolean {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);

  if (leftNumber !== null && rightNumber !== null) {
    switch (operator) {
      case ">":
        return leftNumber > rightNumber;
      case ">=":
        return leftNumber >= rightNumber;
      case "<":
        return leftNumber < rightNumber;
      case "<=":
        return leftNumber <= rightNumber;
      case "=":
      case "==":
        return leftNumber === rightNumber;
      default:
        return false;
    }
  }

  switch (operator) {
    case "=":
    case "==":
      return String(left) === String(right);
    default:
      return false;
  }
}

export class PestConfigService {
  constructor(private database: typeof db) {}

  async getPestConfig(orgId: string, pestKeyOrLabel: string) {
    const [exact, lower, snake] = toLookupCandidates(pestKeyOrLabel);

    return this.database.query.pestConfigurations.findFirst({
      where: and(
        eq(pestConfigurations.orgId, orgId),
        eq(pestConfigurations.active, true),
        or(
          eq(pestConfigurations.key, exact ?? pestKeyOrLabel),
          eq(pestConfigurations.key, lower ?? pestKeyOrLabel),
          eq(pestConfigurations.key, snake ?? pestKeyOrLabel),
          eq(pestConfigurations.label, pestKeyOrLabel)
        )
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
  }

  assessObservation(input: PestAssessmentInput, config: NonNullable<PestConfigRecord>): PestAssessmentResult {
    const observationConfig =
      (input.observationMethod
        ? config.observationConfigs.find((item) => item.method === input.observationMethod && item.active)
        : null) ??
      config.observationConfigs.find(
        (item) => item.method === config.defaultObservationMethod && item.active
      ) ??
      config.observationConfigs.find((item) => item.active);

    if (!observationConfig) {
      throw new Error(`No active observation configuration found for pest ${config.key}`);
    }

    const normalizedRaw = { ...input.raw };
    if (
      observationConfig.countFieldKey &&
      normalizedRaw[observationConfig.countFieldKey] === undefined &&
      normalizedRaw.count !== undefined
    ) {
      normalizedRaw[observationConfig.countFieldKey] = normalizedRaw.count;
    }

    const derived = this.computeDerivedValues(normalizedRaw, observationConfig.derivedDefinitions);
    const severity = this.computeSeverity(normalizedRaw, derived, observationConfig.severityRules);
    const observedCount = observationConfig.countFieldKey
      ? toNumber(normalizedRaw[observationConfig.countFieldKey])
      : null;

    return {
      pestConfigurationId: config.id,
      pestKey: config.key,
      pestLabel: config.label,
      observationMethod: observationConfig.method,
      observedCount,
      derived,
      severity,
      alertTriggered: this.isAlertTriggered(config.alertTrigger, severity),
      alertTriggerReason: `alert_trigger:${config.alertTrigger}`,
    };
  }

  private computeDerivedValues(
    raw: Record<string, unknown>,
    derivedDefinitions: unknown
  ): Record<string, unknown> {
    if (!derivedDefinitions || typeof derivedDefinitions !== "object") {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const [key, definition] of Object.entries(
      derivedDefinitions as Record<string, Record<string, unknown>>
    )) {
      if (!definition || typeof definition !== "object") continue;

      if (definition.formula === "ratio") {
        const numerator = toNumber(raw[String(definition.numeratorField)]);
        const denominator = toNumber(raw[String(definition.denominatorField)]);
        result[key] =
          numerator !== null && denominator !== null && denominator > 0
            ? numerator / denominator
            : null;
      }
    }

    return result;
  }

  private computeSeverity(
    raw: Record<string, unknown>,
    derived: Record<string, unknown>,
    rules: Array<{
      severity: Severity;
      conditionKind: "NUMERIC" | "DERIVED" | "CATEGORICAL" | "DEFAULT";
      conditionExpression: unknown;
      ruleOrder: number;
    }>
  ): Severity {
    const orderedRules = [...rules].sort((a, b) => a.ruleOrder - b.ruleOrder);

    for (const rule of orderedRules) {
      if (rule.conditionKind === "DEFAULT") {
        return rule.severity;
      }

      const expr = rule.conditionExpression as
        | { field?: string; operator?: string; value?: unknown }
        | undefined;
      if (!expr?.field || !expr.operator) continue;

      const source =
        rule.conditionKind === "DERIVED" ? derived[expr.field] : raw[expr.field];

      if (compareValues(source, expr.operator, expr.value)) {
        return rule.severity;
      }
    }

    return "NORMAL";
  }

  private isAlertTriggered(trigger: AlertTrigger, severity: Severity): boolean {
    switch (trigger) {
      case "NONE":
        return false;
      case "HIGH_ONLY":
        return severity === "HIGH";
      case "WARNING_AND_HIGH":
        return severity === "WARNING" || severity === "HIGH";
      default:
        return false;
    }
  }
}

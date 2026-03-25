import { db } from "~/server/db";
import { orgAlertThresholds } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { PestConfigService, type ObservationMethod } from "./pest-config-service";

export type Severity = "NORMAL" | "WARNING" | "HIGH";

export interface AlertThreshold {
  normalMax: number; // Exclusive upper bound for NORMAL (value <= normalMax)
  warningMax: number; // Exclusive upper bound for WARNING (normalMax < value <= warningMax)
  // HIGH: value > warningMax
}

export interface PestAssessmentOutcome {
  severity: Severity;
  source: "ORG_CONFIG" | "DEFAULT_FALLBACK";
  pestConfigurationId: string | null;
  pestKey: string | null;
  pestLabel: string | null;
  observationMethod: ObservationMethod | null;
  observedCount: number | null;
  derived: Record<string, unknown>;
  alertTriggered: boolean;
  alertTriggerReason: string | null;
}

export class AlertsService {
  constructor(
    private database: typeof db,
    private orgId: string | undefined,
    private userRole: "super_admin" | "org_admin" | "officer"
  ) {}

  private get pestConfigService() {
    return new PestConfigService(this.database);
  }

  /**
   * Get all alert thresholds for an organization
   */
  async getThresholds(orgId?: string): Promise<
    Array<{
      id: string;
      pestKey: string;
      normalMax: number;
      warningMax: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    // Determine target org
    let targetOrgId: string;
    if (this.userRole === "super_admin") {
      if (!orgId) {
        // Super admin without orgId: return empty (or could return first org, but explicit is better)
        return [];
      }
      targetOrgId = orgId;
    } else {
      // org_admin: use own org
      if (!this.orgId) {
        return [];
      }
      targetOrgId = this.orgId;
    }

    return this.database.query.orgAlertThresholds.findMany({
      where: eq(orgAlertThresholds.orgId, targetOrgId),
      orderBy: (thresholds, { asc }) => [asc(thresholds.pestKey)],
    });
  }

  /**
   * Get threshold for a specific pest
   */
  async getThresholdForPest(
    orgId: string,
    pestKey: string
  ): Promise<AlertThreshold | null> {
    const threshold = await this.database.query.orgAlertThresholds.findFirst({
      where: and(
        eq(orgAlertThresholds.orgId, orgId),
        eq(orgAlertThresholds.pestKey, pestKey)
      ),
    });

    if (!threshold) {
      return null;
    }

    return {
      normalMax: threshold.normalMax,
      warningMax: threshold.warningMax,
    };
  }

  /**
   * Compute severity based on pest, count, and org thresholds
   * Returns both severity and source (ORG_CONFIG or DEFAULT_FALLBACK)
   */
  async computeSeverity(
    orgId: string,
    pestKey: string,
    observedCount: number | null
  ): Promise<{ severity: Severity; source: "ORG_CONFIG" | "DEFAULT_FALLBACK" }> {
    const assessment = await this.computePestAssessment({
      orgId,
      pestKey,
      raw: observedCount === null || observedCount === undefined ? {} : { count: observedCount },
    });

    if (assessment.source === "ORG_CONFIG" && assessment.pestConfigurationId) {
      return {
        severity: assessment.severity,
        source: assessment.source,
      };
    }

    // If no count provided, default to NORMAL with ORG_CONFIG source
    // (This is a data quality issue, not a threshold config issue)
    if (observedCount === null || observedCount === undefined) {
      return { severity: "NORMAL", source: "ORG_CONFIG" };
    }

    const threshold = await this.getThresholdForPest(orgId, pestKey);

    // If no threshold config exists, use sensible fallback logic
    if (!threshold) {
      // Fallback logic: 0 = NORMAL, 1-20 = WARNING, 21+ = HIGH
      if (observedCount === 0) {
        return { severity: "NORMAL", source: "DEFAULT_FALLBACK" };
      } else if (observedCount <= 20) {
        return { severity: "WARNING", source: "DEFAULT_FALLBACK" };
      } else {
        return { severity: "HIGH", source: "DEFAULT_FALLBACK" };
      }
    }

    // Apply org-defined thresholds
    let severity: Severity;
    if (observedCount <= threshold.normalMax) {
      severity = "NORMAL";
    } else if (observedCount <= threshold.warningMax) {
      severity = "WARNING";
    } else {
      severity = "HIGH";
    }

    return { severity, source: "ORG_CONFIG" };
  }

  async computePestAssessment(input: {
    orgId: string;
    pestKey: string;
    observationMethod?: ObservationMethod | null;
    raw: Record<string, unknown>;
  }): Promise<PestAssessmentOutcome> {
    const pestConfig = await this.pestConfigService.getPestConfig(
      input.orgId,
      input.pestKey
    );

    if (pestConfig) {
      const assessment = this.pestConfigService.assessObservation(input, pestConfig);
      return {
        severity: assessment.severity,
        source: "ORG_CONFIG",
        pestConfigurationId: assessment.pestConfigurationId,
        pestKey: assessment.pestKey,
        pestLabel: assessment.pestLabel,
        observationMethod: assessment.observationMethod,
        observedCount: assessment.observedCount,
        derived: assessment.derived,
        alertTriggered: assessment.alertTriggered,
        alertTriggerReason: assessment.alertTriggerReason,
      };
    }

    const observedCount =
      typeof input.raw.count === "number"
        ? Math.floor(input.raw.count)
        : typeof input.raw.count === "string"
          ? Number.parseInt(input.raw.count, 10)
          : null;

    const severityResult = await this.computeLegacySeverity(input.orgId, input.pestKey, observedCount);
    return {
      severity: severityResult.severity,
      source: severityResult.source,
      pestConfigurationId: null,
      pestKey: input.pestKey,
      pestLabel: input.pestKey,
      observationMethod: input.observationMethod ?? null,
      observedCount,
      derived: {},
      alertTriggered:
        severityResult.source === "ORG_CONFIG"
          ? severityResult.severity === "WARNING" || severityResult.severity === "HIGH"
          : severityResult.severity === "HIGH",
      alertTriggerReason:
        severityResult.source === "ORG_CONFIG"
          ? "legacy_thresholds"
          : "default_fallback_guidance",
    };
  }

  private async computeLegacySeverity(
    orgId: string,
    pestKey: string,
    observedCount: number | null
  ): Promise<{ severity: Severity; source: "ORG_CONFIG" | "DEFAULT_FALLBACK" }> {
    // If no count provided, default to NORMAL with ORG_CONFIG source
    // (This is a data quality issue, not a threshold config issue)
    if (observedCount === null || observedCount === undefined) {
      return { severity: "NORMAL", source: "ORG_CONFIG" };
    }

    const threshold = await this.getThresholdForPest(orgId, pestKey);

    // If no threshold config exists, use sensible fallback logic
    if (!threshold) {
      // Fallback logic: 0 = NORMAL, 1-20 = WARNING, 21+ = HIGH
      if (observedCount === 0) {
        return { severity: "NORMAL", source: "DEFAULT_FALLBACK" };
      } else if (observedCount <= 20) {
        return { severity: "WARNING", source: "DEFAULT_FALLBACK" };
      } else {
        return { severity: "HIGH", source: "DEFAULT_FALLBACK" };
      }
    }

    // Apply org-defined thresholds
    let severity: Severity;
    if (observedCount <= threshold.normalMax) {
      severity = "NORMAL";
    } else if (observedCount <= threshold.warningMax) {
      severity = "WARNING";
    } else {
      severity = "HIGH";
    }

    return { severity, source: "ORG_CONFIG" };
  }

  /**
   * Upsert (create or update) threshold for a pest
   */
  async upsertThreshold(
    orgId: string | undefined,
    pestKey: string,
    thresholds: AlertThreshold
  ): Promise<{ id: string }> {
    // Determine target org
    let targetOrgId: string;
    if (this.userRole === "super_admin") {
      if (!orgId) {
        throw new Error("orgId required for super_admin");
      }
      targetOrgId = orgId;
    } else {
      // org_admin: use own org
      if (!this.orgId) {
        throw new Error("Organization ID required");
      }
      targetOrgId = this.orgId;
    }

    // Validate thresholds
    if (thresholds.normalMax >= thresholds.warningMax) {
      throw new Error(
        "normalMax must be less than warningMax"
      );
    }

    // Check if threshold exists
    const existing = await this.database.query.orgAlertThresholds.findFirst({
      where: and(
        eq(orgAlertThresholds.orgId, targetOrgId),
        eq(orgAlertThresholds.pestKey, pestKey)
      ),
    });

    if (existing) {
      // Update
      const [updated] = await this.database
        .update(orgAlertThresholds)
        .set({
          normalMax: thresholds.normalMax,
          warningMax: thresholds.warningMax,
          updatedAt: new Date(),
        })
        .where(eq(orgAlertThresholds.id, existing.id))
        .returning({ id: orgAlertThresholds.id });

      return { id: updated!.id };
    } else {
      // Insert
      const [inserted] = await this.database
        .insert(orgAlertThresholds)
        .values({
          orgId: targetOrgId,
          pestKey,
          normalMax: thresholds.normalMax,
          warningMax: thresholds.warningMax,
        })
        .returning({ id: orgAlertThresholds.id });

      return { id: inserted!.id };
    }
  }
}




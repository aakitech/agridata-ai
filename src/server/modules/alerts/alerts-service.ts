import { db } from "~/server/db";
import { orgAlertThresholds } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

export type Severity = "NORMAL" | "WARNING" | "HIGH";

export interface AlertThreshold {
  normalMax: number; // Exclusive upper bound for NORMAL (value <= normalMax)
  warningMax: number; // Exclusive upper bound for WARNING (normalMax < value <= warningMax)
  // HIGH: value > warningMax
}

export class AlertsService {
  constructor(
    private database: typeof db,
    private orgId: string | undefined,
    private userRole: "super_admin" | "org_admin" | "officer"
  ) {}

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
   */
  async computeSeverity(
    orgId: string,
    pestKey: string,
    observedCount: number | null
  ): Promise<Severity> {
    // If no count provided, default to NORMAL
    if (observedCount === null || observedCount === undefined) {
      return "NORMAL";
    }

    const threshold = await this.getThresholdForPest(orgId, pestKey);

    // If no threshold config exists, default to NORMAL
    if (!threshold) {
      return "NORMAL";
    }

    // Apply thresholds
    if (observedCount <= threshold.normalMax) {
      return "NORMAL";
    } else if (observedCount <= threshold.warningMax) {
      return "WARNING";
    } else {
      return "HIGH";
    }
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


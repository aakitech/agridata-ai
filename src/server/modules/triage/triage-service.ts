import { db } from "~/server/db";
import { reports } from "~/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

export class TriageService {
  constructor(private database: typeof db, private orgId: string | undefined, private userRole: "super_admin" | "org_admin" | "officer") {}

  async getReportsByStatus(status: "PENDING_TRIAGE" | "VERIFIED" | "REJECTED" = "PENDING_TRIAGE", filterOrgId?: string) {
    // If not super admin, orgId is required
    if (this.userRole !== "super_admin" && !this.orgId) return [];

    return this.database.query.reports.findMany({
      where: (reports, { eq, and }) => {
        const conditions = [
          eq(reports.status, status),
        ];

        // Apply Org ID filter:
        // 1. If Super Admin AND filterOrgId is provided -> Filter by that org
        // 2. If NOT Super Admin -> Enforce specific org
        // 3. If Super Admin AND no filter -> Show all (no condition added)
        if (this.userRole === "super_admin") {
          if (filterOrgId) {
            conditions.push(eq(reports.orgId, filterOrgId));
          }
        } else {
           conditions.push(eq(reports.orgId, this.orgId!));
        }
        
        return and(...conditions);
      },
      with: {
        user: true,
        media: true,
        organization: true, // Always fetch organization for display
        weather: true,
      },
      orderBy: (reports, { desc }) =>
        status === "PENDING_TRIAGE"
          ? [
              sql`${reports.severity} DESC NULLS LAST`,
              desc(reports.createdAt),
            ]
          : [desc(reports.verifiedAt)],
    });
  }

  async getReportById(id: string) {
    if (this.userRole !== "super_admin" && !this.orgId) return null;

    return this.database.query.reports.findFirst({
      where: (reports, { eq, and }) => {
        const conditions = [eq(reports.id, id)];
        
        if (this.userRole !== "super_admin") {
          conditions.push(eq(reports.orgId, this.orgId!));
        }
        
        return and(...conditions);
      },
      with: {
        user: true,
        media: true,
        organization: true,
        weather: true,
      },
    });
  }

  async verifyReport(input: {
    id: string;
    diagnosis: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  }, verifiedBy?: string) {
    if (this.userRole !== "super_admin" && !this.orgId) throw new Error("Org ID required");

    // Super admins can verify any report. Org admins can only verify their own.
    const whereClause = this.userRole === "super_admin" 
      ? eq(reports.id, input.id)
      : and(eq(reports.id, input.id), eq(reports.orgId, this.orgId!));

    const [updated] = await this.database
      .update(reports)
      .set({
        status: "VERIFIED",
        diagnosis: input.diagnosis,
        riskLevel: input.riskLevel,
        verifiedAt: new Date(),
        verifiedBy: verifiedBy, 
      })
      .where(whereClause)
      .returning();

    return updated;
  }

  async rejectReport(input: { id: string; rejectionReason: string }, verifiedBy?: string) {
    if (this.userRole !== "super_admin" && !this.orgId) throw new Error("Org ID required");

    // Super admins can reject any report. Org admins can only reject their own.
    const whereClause = this.userRole === "super_admin" 
      ? eq(reports.id, input.id)
      : and(eq(reports.id, input.id), eq(reports.orgId, this.orgId!));

    const [updated] = await this.database
      .update(reports)
      .set({
        status: "REJECTED",
        rejectionReason: input.rejectionReason,
        verifiedAt: new Date(),
        verifiedBy: verifiedBy, 
      })
      .where(whereClause)
      .returning();

    return updated;
  }
}

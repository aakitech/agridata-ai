import { db } from "~/server/db";
import { reports } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

export class TriageService {
  constructor(private database: typeof db, private orgId?: string) {}

  async getReportsByStatus(status: "PENDING_TRIAGE" | "VERIFIED" | "REJECTED" = "PENDING_TRIAGE") {
    // If orgId is present, filter by it. If not (e.g. system usage?), maybe fetch all? 
    // For safety, we should assume orgId is required for this service in this context.
    // If orgId is missing, return empty or throw? 
    // Let's assume passed orgId is required for dashboard usage.
    if (!this.orgId) return [];

    return this.database.query.reports.findMany({
      where: (reports, { eq, and }) => and(
          eq(reports.status, status),
          eq(reports.orgId, this.orgId!)
      ),
      with: {
        user: true,
        media: true,
      },
      orderBy: (reports, { desc, asc }) => 
        status === "PENDING_TRIAGE" 
          ? [desc(reports.createdAt)] 
          : [desc(reports.verifiedAt)],
    });
  }

  async getReportById(id: string) {
    if (!this.orgId) return null;

    return this.database.query.reports.findFirst({
      where: (reports, { eq, and }) => and(
          eq(reports.id, id),
          eq(reports.orgId, this.orgId!)
      ),
      with: {
        user: true,
        media: true,
      },
    });
  }

  async verifyReport(input: {
    id: string;
    diagnosis: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  }, verifiedBy?: string) {
    if (!this.orgId) throw new Error("Org ID required");

    // We rely on 'where' clause to ensure ownership
    const [updated] = await this.database
      .update(reports)
      .set({
        status: "VERIFIED",
        diagnosis: input.diagnosis,
        riskLevel: input.riskLevel,
        verifiedAt: new Date(),
        verifiedBy: verifiedBy, 
      })
      .where(and(eq(reports.id, input.id), eq(reports.orgId, this.orgId)))
      .returning();

    return updated;
  }

  async rejectReport(input: { id: string; rejectionReason: string }, verifiedBy?: string) {
    if (!this.orgId) throw new Error("Org ID required");

    const [updated] = await this.database
      .update(reports)
      .set({
        status: "REJECTED",
        rejectionReason: input.rejectionReason,
        verifiedAt: new Date(),
        verifiedBy: verifiedBy, 
      })
      .where(and(eq(reports.id, input.id), eq(reports.orgId, this.orgId)))
      .returning();

    return updated;
  }
}

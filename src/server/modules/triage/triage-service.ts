import { db } from "~/server/db";
import { reports } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export class TriageService {
  constructor(private database: typeof db) {}

  async getReportsByStatus(status: "PENDING_TRIAGE" | "VERIFIED" | "REJECTED" = "PENDING_TRIAGE") {
    return this.database.query.reports.findMany({
      where: (reports, { eq }) => eq(reports.status, status),
      with: {
        user: true,
        media: true,
      },
      orderBy: (reports, { desc, asc }) => 
        status === "PENDING_TRIAGE" 
          ? [asc(reports.createdAt)] 
          : [desc(reports.verifiedAt)],
    });
  }

  async getReportById(id: string) {
    return this.database.query.reports.findFirst({
      where: (reports, { eq }) => eq(reports.id, id),
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
  }) {
    const [updated] = await this.database
      .update(reports)
      .set({
        status: "VERIFIED",
        diagnosis: input.diagnosis,
        riskLevel: input.riskLevel,
        verifiedAt: new Date(),
        // verifiedBy: ctx.session?.user?.id, // Add when auth is implemented
      })
      .where(eq(reports.id, input.id))
      .returning();

    return updated;
  }

  async rejectReport(input: { id: string; rejectionReason: string }) {
    const [updated] = await this.database
      .update(reports)
      .set({
        status: "REJECTED",
        rejectionReason: input.rejectionReason,
        verifiedAt: new Date(),
        // verifiedBy: ctx.session?.user?.id, // Add when auth is implemented
      })
      .where(eq(reports.id, input.id))
      .returning();

    return updated;
  }
}

import { db } from "~/server/db";
import { reports } from "~/server/db/schema";
import { eq, and, gte, lte, sql, count, desc } from "drizzle-orm";
import type { MpbcReportData } from "./report-types";
import { parseLocation } from "./report-utils";

export class ReportService {
  constructor(private database: typeof db) {}

  async buildMpbcWeeklyReport(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MpbcReportData> {
    // Fetch organization
    const org = await this.database.query.organizations.findFirst({
      where: (organizations, { eq }) => eq(organizations.id, orgId),
    });

    if (!org) {
      throw new Error(`Organization ${orgId} not found`);
    }

    // Build date filter (inclusive of both start and end dates)
    const dateFilter = and(
      gte(reports.createdAt, startDate),
      lte(reports.createdAt, endDate),
      eq(reports.orgId, orgId)
    );

    // Fetch all reports in the period with relations
    const allReportsData = await this.database.query.reports.findMany({
      where: dateFilter,
      with: {
        user: true,
        organization: true,
      },
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
    });

    // Normalize count field:
    // Some historical MPBC reports store count in dataPayload.count (or quantity) but not in observedCount.
    const normalizedReports = allReportsData.map((r) => {
      if (r.observedCount != null) return r;

      const payload = (r.dataPayload ?? null) as unknown as Record<string, unknown> | null;
      const payloadCount = payload ? (payload as any).count : null;
      const payloadQuantity = payload ? (payload as any).quantity : null;

      const fromPayload =
        typeof payloadCount === "number"
          ? Math.floor(payloadCount)
          : typeof payloadCount === "string"
            ? Number.parseInt(payloadCount, 10)
            : null;

      const fromQuantity =
        typeof r.quantity === "string"
          ? Number.parseInt(r.quantity, 10)
          : typeof payloadQuantity === "string"
            ? Number.parseInt(payloadQuantity, 10)
            : null;

      const derived =
        fromPayload != null && !Number.isNaN(fromPayload) ? fromPayload
        : fromQuantity != null && !Number.isNaN(fromQuantity) ? fromQuantity
        : null;

      if (derived == null) return r;
      return { ...r, observedCount: derived };
    });

    // Compute summary metrics
    const [totalReportsResult] = await this.database
      .select({ count: count() })
      .from(reports)
      .where(dateFilter);

    const [activeOfficersResult] = await this.database
      .select({ value: sql<number>`count(distinct ${reports.userId})` })
      .from(reports)
      .where(dateFilter);

    // Count unique locations (non-null, distinct)
    const uniqueLocationsSet = new Set<string>();
    normalizedReports.forEach((report) => {
      if (report.location) {
        uniqueLocationsSet.add(report.location);
      }
    });

    // Filter high alert reports
    const highAlertReports = normalizedReports.filter(
      (report) => report.severity === "HIGH"
    );

    // Sort all reports by severity (HIGH → WARNING → NORMAL), then by date DESC
    const severityOrder = { HIGH: 0, WARNING: 1, NORMAL: 2 };
    const sortedAllReports = [...normalizedReports].sort((a, b) => {
      const aSeverity = a.severity ?? "NORMAL";
      const bSeverity = b.severity ?? "NORMAL";
      
      const aOrder = severityOrder[aSeverity as keyof typeof severityOrder] ?? 3;
      const bOrder = severityOrder[bSeverity as keyof typeof severityOrder] ?? 3;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // Same severity, sort by date DESC
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Sort high alert reports by date DESC
    const sortedHighAlertReports = [...highAlertReports].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Extract map points (only reports with valid locations)
    const mapPoints = normalizedReports
      .map((report) => {
        const coords = parseLocation(report.location);
        if (!coords) return null;
        return {
          lat: coords.lat,
          lon: coords.lon,
          severity: report.severity,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return {
      organization: {
        id: org.id,
        name: org.name,
      },
      period: {
        startDate,
        endDate,
      },
      summaryMetrics: {
        totalReports: totalReportsResult?.count ?? 0,
        activeOfficers: activeOfficersResult?.value ?? 0,
        uniqueLocations: uniqueLocationsSet.size,
        highAlertCount: highAlertReports.length,
      },
      highAlertReports: sortedHighAlertReports,
      allReports: sortedAllReports,
      mapPoints,
    };
  }
}


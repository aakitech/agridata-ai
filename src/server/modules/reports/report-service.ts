import { db } from "~/server/db";
import { reports } from "~/server/db/schema";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import type { MpbcReportData, ReportWithRelations } from "./report-types";
import { parseLocation } from "./report-utils";

// Local cache for geocoding to avoid redundant API calls and respect rate limits
const geocodeCache = new Map<string, string | null>();

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

    // Batch geocode unique locations
    const reportsWithGeocoding = await this.enrichWithGeocoding(sortedAllReports);
    const highAlertsWithGeocoding = await this.enrichWithGeocoding(sortedHighAlertReports);

    // Build province breakdown from all reports with geocoding
    const provinceMap = new Map<string, {
      totalReports: number;
      locations: Set<string>;
      highAlerts: number;
      warningAlerts: number;
      normalAlerts: number;
    }>();

    for (const report of reportsWithGeocoding) {
      const province = report.province ?? "Unknown";
      
      const existing = provinceMap.get(province) ?? {
        totalReports: 0,
        locations: new Set<string>(),
        highAlerts: 0,
        warningAlerts: 0,
        normalAlerts: 0,
      };

      existing.totalReports += 1;
      if (report.location) {
        existing.locations.add(report.location);
      }

      switch (report.severity) {
        case "HIGH":
          existing.highAlerts += 1;
          break;
        case "WARNING":
          existing.warningAlerts += 1;
          break;
        case "NORMAL":
          existing.normalAlerts += 1;
          break;
      }

      provinceMap.set(province, existing);
    }

    const totalReportsCount = totalReportsResult?.count ?? 0;
    const provinceBreakdown = Array.from(provinceMap.entries())
      .map(([province, data]) => ({
        province,
        totalReports: data.totalReports,
        locations: data.locations.size,
        highAlerts: data.highAlerts,
        warningAlerts: data.warningAlerts,
        normalAlerts: data.normalAlerts,
        sharePercentage: totalReportsCount > 0 ? (data.totalReports / totalReportsCount) * 100 : 0,
      }))
      .sort((a, b) => b.totalReports - a.totalReports);

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
      highAlertReports: highAlertsWithGeocoding,
      allReports: reportsWithGeocoding,
      mapPoints,
      provinceBreakdown,
    };
  }

  private async enrichWithGeocoding(reports: ReportWithRelations[]): Promise<Array<ReportWithRelations & { province?: string }>> {
    const enriched = [...reports];
    const uniqueLocations = new Set<string>();
    
    reports.forEach(r => {
      if (r.location) uniqueLocations.add(r.location);
    });

    const locationMap = new Map<string, string | null>();
    const provinceMap = new Map<string, string>();
    
    for (const loc of uniqueLocations) {
      if (geocodeCache.has(loc)) {
        locationMap.set(loc, geocodeCache.get(loc)!);
        continue;
      }

      const coords = parseLocation(loc);
      if (!coords) continue;

      try {
        // Respect Nominatim rate limits (1 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}`,
          {
            headers: {
              "User-Agent": "AgriDataAI/1.0 (contact@agridata.ai)",
            },
          }
        );

        if (response.ok) {
          const data = await response.json() as any;
          if (data && data.address) {
            const addr = data.address;
            const descriptive = addr.suburb || addr.neighborhood || addr.village || addr.town || addr.city || addr.state || "";
            const area = addr.city || addr.state || addr.country || "";
            const result = descriptive !== area && area ? `${descriptive}, ${area}` : descriptive || area || null;
            
            // Extract province (state or county)
            const province = addr.state || addr.province || addr.county || "Unknown";
            
            geocodeCache.set(loc, result);
            locationMap.set(loc, result);
            provinceMap.set(loc, province);
          } else {
            geocodeCache.set(loc, null);
          }
        }
      } catch (error) {
        console.error("Geocoding failed for:", loc, error);
      }
    }

    return enriched.map(r => ({
      ...r,
      geocodedLocation: r.location ? locationMap.get(r.location) : null,
      province: r.location ? provinceMap.get(r.location) : undefined,
    }));
  }
}


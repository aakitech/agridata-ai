import { db } from "~/server/db";
import { reports, appUsers } from "~/server/db/schema";
import { eq, and, sql, desc, gte, lte, count } from "drizzle-orm";
import { subDays } from "date-fns";
import {
  haversineDistanceMeters,
  parseLocation,
  formatLatLonKey,
  LOCATION_CLUSTER_RADIUS_METERS,
} from "~/lib/geo";

export class AnalyticsService {
  constructor(
    private database: typeof db,
    private orgId: string | undefined,
    private userRole: "super_admin" | "org_admin" | "officer"
  ) {}

  private getOrgFilter() {
    if (this.userRole === "super_admin") {
      return undefined; // No filter by default, unless specified in method
    }
    return eq(reports.orgId, this.orgId!);
  }

  // Combine base filter with optional dynamic filter
  private getCombinedFilter(filterOrgId?: string, range?: "7d" | "30d") {
    const conditions = [];
    const baseFilter = this.getOrgFilter();
    if (baseFilter) conditions.push(baseFilter);

    // If Super Admin and passed a specific org filter
    if (this.userRole === "super_admin" && filterOrgId) {
      conditions.push(eq(reports.orgId, filterOrgId));
    }

    // Add time range filter if provided
    if (range) {
      const days = range === "7d" ? 7 : 30;
      const startDate = subDays(new Date(), days);
      conditions.push(gte(reports.createdAt, startDate));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async getStats(filterOrgId?: string, range?: "7d" | "30d") {
    // Total Reports: all-time (org-scoped, no range filter)
    const totalWhereClause = this.getCombinedFilter(filterOrgId);
    const [totalReports] = await this.database
      .select({ count: count() })
      .from(reports)
      .where(totalWhereClause);

    // Reports This Period: within selected range
    const periodWhereClause = this.getCombinedFilter(filterOrgId, range);
    const [reportsThisPeriod] = await this.database
      .select({ count: count() })
      .from(reports)
      .where(periodWhereClause);

    // Active Scouts: distinct officers with ≥1 report in selected range
    const [activeScouts] = await this.database
      .select({ value: sql<number>`count(distinct ${reports.userId})` })
      .from(reports)
      .where(periodWhereClause);

    // High Alert Reports: count of reports with severity = HIGH in selected range
    const highAlertWhereClause = periodWhereClause
      ? and(periodWhereClause, eq(reports.severity, "HIGH"))
      : eq(reports.severity, "HIGH");
    const [highAlertCount] = await this.database
      .select({ count: count() })
      .from(reports)
      .where(highAlertWhereClause);

    return {
      totalReports: totalReports?.count ?? 0,
      reportsThisPeriod: reportsThisPeriod?.count ?? 0,
      activeScouts: activeScouts?.value ?? 0,
      highAlertCount: highAlertCount?.count ?? 0,
    };
  }

  async getReportsOverTime(range: "7d" | "30d" = "7d", filterOrgId?: string) {
    const whereClause = this.getCombinedFilter(filterOrgId);
    const days = range === "7d" ? 7 : 30;
    const startDate = subDays(new Date(), days);

    // Group by date (truncated)
    const dailyStats = await this.database
      .select({
        date: sql<string>`to_char(${reports.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(reports)
      .where(
        whereClause
          ? and(whereClause, gte(reports.createdAt, startDate))
          : gte(reports.createdAt, startDate)
      )
      .groupBy(sql`to_char(${reports.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${reports.createdAt}, 'YYYY-MM-DD')`);

    return dailyStats;
  }

  async getPestDistribution(filterOrgId?: string, range?: "7d" | "30d") {
    const whereClause = this.getCombinedFilter(filterOrgId, range);

    // Group by label (pest name from bot workflow)
    const distribution = await this.database
      .select({
        name: reports.label,
        count: count(),
      })
      .from(reports)
      .where(whereClause)
      .groupBy(reports.label)
      .orderBy(desc(count()))
      .limit(10);

    return distribution;
  }

  async getRecentReports(
    limit: number = 5,
    filterOrgId?: string,
    range?: "7d" | "30d"
  ) {
    const whereClause = this.getCombinedFilter(filterOrgId, range);

    return this.database.query.reports.findMany({
      where: whereClause,
      with: {
        organization: true,
        user: true,
      },
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
      limit: limit,
    });
  }

  async getMapPoints(filterOrgId?: string, range?: "7d" | "30d") {
    const whereClause = this.getCombinedFilter(filterOrgId, range);

    // Fetch reports with locations using query builder to include user relation
    const reportResults = await this.database.query.reports.findMany({
      where: whereClause
        ? and(whereClause, sql`${reports.location} is not null`)
        : sql`${reports.location} is not null`,
      with: {
        user: true,
      },
      limit: 200,
    });

    return reportResults
      .map((r) => {
        const coordinates = parseLocation(r.location);
        if (!coordinates) return null;
        return {
          id: r.id,
          lat: coordinates.lat,
          lon: coordinates.lon,
          pest: r.label || "Unknown",
          severity: r.severity,
          count: r.observedCount,
          date: r.createdAt,
          officerName: r.user?.fullName || r.user?.phoneNumber || "Unknown",
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  // New methods for Reports page
  async getAllReports(
    options: {
      startDate?: Date;
      severity?: "HIGH" | "WARNING" | "NORMAL";
      officerId?: string;
      orgId?: string;
      pest?: string;
      page?: number;
      limit?: number;
      sort?: "DATE_DESC" | "DATE_ASC";
    } = {}
  ): Promise<{
    reports: ReportWithDetails[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { startDate, severity, officerId, orgId, pest, page = 1, limit = 25, sort = "DATE_DESC" } = options;

    const conditions = [];
    const baseFilter = this.getOrgFilter();
    if (baseFilter) conditions.push(baseFilter);

    if (this.userRole === "super_admin" && orgId) {
      conditions.push(eq(reports.orgId, orgId));
    }

    if (startDate) {
      conditions.push(gte(reports.createdAt, startDate));
    }

    if (severity) {
      conditions.push(eq(reports.severity, severity));
    }

    if (officerId) {
      conditions.push(eq(reports.userId, officerId));
    }

    if (pest) {
      if (pest === "__unknown__") {
        conditions.push(sql`${reports.label} is null`);
      } else {
        conditions.push(eq(reports.label, pest));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await this.database
      .select({ count: count() })
      .from(reports)
      .where(whereClause);
    const total = countResult?.count ?? 0;

    // Get paginated reports
    const reportResults = await this.database.query.reports.findMany({
      where: whereClause,
      with: {
        organization: true,
        user: true,
      },
      orderBy: (reports, { desc, asc }) => [
        sort === "DATE_ASC" ? asc(reports.createdAt) : desc(reports.createdAt),
      ],
      limit: limit,
      offset: (page - 1) * limit,
    });

    return {
      reports: reportResults,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReportsByLocation(
    options: {
      startDate?: Date;
      severity?: "HIGH" | "WARNING" | "NORMAL";
      officerId?: string;
      orgId?: string;
      pest?: string;
    } = {}
  ): Promise<LocationWithReports[]> {
    const { startDate, severity, officerId, orgId, pest } = options;

    const conditions = [];
    const baseFilter = this.getOrgFilter();
    if (baseFilter) conditions.push(baseFilter);

    if (this.userRole === "super_admin" && orgId) {
      conditions.push(eq(reports.orgId, orgId));
    }

    if (startDate) {
      conditions.push(gte(reports.createdAt, startDate));
    }

    if (severity) {
      conditions.push(eq(reports.severity, severity));
    }

    if (officerId) {
      conditions.push(eq(reports.userId, officerId));
    }

    if (pest) {
      if (pest === "__unknown__") {
        conditions.push(sql`${reports.label} is null`);
      } else {
        conditions.push(eq(reports.label, pest));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch all reports with location
    const reportResults = await this.database.query.reports.findMany({
      where: whereClause
        ? and(whereClause, sql`${reports.location} is not null`)
        : sql`${reports.location} is not null`,
      with: {
        organization: true,
        user: true,
      },
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
      limit: 500,
    });

    // Group by location using a ~25m radius clustering (handles GPS jitter & near-duplicates)
    const parsed = reportResults
      .map((report) => {
        const coordinates = parseLocation(report.location);
        if (!coordinates) return null;
        return { report, lat: coordinates.lat, lon: coordinates.lon };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Process oldest → newest so cluster keys stay stable as new reports arrive
    parsed.sort((a, b) => a.report.createdAt.getTime() - b.report.createdAt.getTime());

    type Cluster = {
      key: string;
      seed: { lat: number; lon: number };
      centroid: { lat: number; lon: number };
      count: number;
      reports: typeof reportResults;
    };

    const clusters: Cluster[] = [];

    for (const item of parsed) {
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i]!;
        const d = haversineDistanceMeters(cluster.centroid, { lat: item.lat, lon: item.lon });
        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = i;
        }
      }

      if (bestIndex !== -1 && bestDistance <= LOCATION_CLUSTER_RADIUS_METERS) {
        const cluster = clusters[bestIndex]!;
        cluster.reports.push(item.report);
        cluster.count += 1;
        // Online centroid update
        cluster.centroid = {
          lat: cluster.centroid.lat + (item.lat - cluster.centroid.lat) / cluster.count,
          lon: cluster.centroid.lon + (item.lon - cluster.centroid.lon) / cluster.count,
        };
        continue;
      }

      const key = formatLatLonKey(item.lat, item.lon);
      clusters.push({
        key,
        seed: { lat: item.lat, lon: item.lon },
        centroid: { lat: item.lat, lon: item.lon },
        count: 1,
        reports: [item.report],
      });
    }

    // Transform to LocationWithReports
    const locations: LocationWithReports[] = [];

    for (const cluster of clusters) {
      const groupReports = cluster.reports;

      // Sort by date desc
      groupReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = groupReports[0]!;

      // Calculate trend
      let trend: "up" | "down" | "stable" = "stable";
      if (groupReports.length > 1) {
        const prev = groupReports[1];
        const currCount = latest.observedCount ?? 0;
        const prevCount = prev?.observedCount ?? 0;
        if (currCount > prevCount) trend = "up";
        else if (currCount < prevCount) trend = "down";
      }

      locations.push({
        locationKey: cluster.key,
        displayName: null, // Will be populated via reverse geocoding on client
        coordinates: {
          lat: cluster.centroid.lat,
          lon: cluster.centroid.lon,
        },
        reportCount: groupReports.length,
        latestReport: {
          id: latest.id,
          date: latest.createdAt,
          severity: latest.severity,
          count: latest.observedCount,
          pest: latest.label || "Unknown",
          officer: latest.user?.fullName || latest.user?.phoneNumber || "Unknown",
        },
        trend,
        reports: groupReports.map((r) => ({
          id: r.id,
          date: r.createdAt,
          severity: r.severity,
          count: r.observedCount,
          pest: r.label || "Unknown",
          officer: r.user?.fullName || r.user?.phoneNumber || "Unknown",
          description: r.description,
        })),
      });
    }

    // Sort by most recent activity
    locations.sort((a, b) => b.latestReport.date.getTime() - a.latestReport.date.getTime());

    return locations;
  }
}

// Types for the new methods
export interface ReportWithDetails {
  id: string;
  createdAt: Date;
  description: string | null;
  severity: "NORMAL" | "WARNING" | "HIGH" | null;
  label: string | null;
  observedCount: number | null;
  mediaUrl: string | null;
  location: string | null;
  user: { fullName: string | null; phoneNumber: string | null } | null;
  organization: { name: string } | null;
}

export interface LocationWithReports {
  locationKey: string;
  displayName: string | null;
  coordinates: { lat: number; lon: number };
  reportCount: number;
  latestReport: {
    id: string;
    date: Date;
    severity: "NORMAL" | "WARNING" | "HIGH" | null;
    count: number | null;
    pest: string;
    officer: string;
  };
  trend: "up" | "down" | "stable";
  reports: Array<{
    id: string;
    date: Date;
    severity: "NORMAL" | "WARNING" | "HIGH" | null;
    count: number | null;
    pest: string;
    officer: string;
    description: string | null;
  }>;
}

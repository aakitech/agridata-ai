import { db } from "~/server/db";
import { reports, appUsers } from "~/server/db/schema";
import { eq, and, sql, desc, gte, lte, count } from "drizzle-orm";
import { subDays, differenceInDays } from "date-fns";

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  pest: string | null;
  severity: "HIGH" | "WARNING" | "NORMAL" | null;
  count: number | null;
  date: Date;
  officerName: string;
  /** Stable bucket key for React keys and one-marker-per-location (e.g. "29.1234,-19.5678") */
  locationKey: string;
  location: string;
  recency: "fresh" | "recent" | "stale";
  recentHistory: Array<{
    id: string;
    pest: string | null;
    severity: "HIGH" | "WARNING" | "NORMAL" | null;
    count: number | null;
    date: Date;
    officerName: string;
  }>;
}

/** 
 * Round to ~0.0002° (~25m) for location bucketing.
 * We multiply by 5000 (1/0.0002) to bucket into ~25m radius groups.
 */
function roundTo25m(n: number): number {
  return Math.round(n * 5000) / 5000;
}

/**
 * Parse WKT POINT(lon lat) and return bucketed key + coordinates.
 * Returns null if parse fails.
 */
function parseLocationBucket(
  locationWkt: string | null
): { key: string; lat: number; lon: number } | null {
  if (!locationWkt) return null;
  const match = locationWkt.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
  if (!match) return null;
  const lon = parseFloat(match[1]!);
  const lat = parseFloat(match[2]!);
  if (Number.isNaN(lon) || Number.isNaN(lat)) return null;
  const bucketLon = roundTo25m(lon);
  const bucketLat = roundTo25m(lat);
  return { key: `${bucketLon},${bucketLat}`, lat: bucketLat, lon: bucketLon };
}

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

    // Add time range filter if provided (default to 7 days for map views)
    if (range) {
      const days = range === "7d" ? 7 : 30;
      const startDate = subDays(new Date(), days);
      conditions.push(gte(reports.createdAt, startDate));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Determines recency category based on report age
   * - fresh: 0-2 days (fully opaque marker)
   * - recent: 3-5 days (slightly faded)
   * - stale: 6+ days (more faded, still within window)
   */
  private getRecency(date: Date): "fresh" | "recent" | "stale" {
    const daysOld = differenceInDays(new Date(), date);
    if (daysOld <= 2) return "fresh";
    if (daysOld <= 5) return "recent";
    return "stale";
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

  async getMapPoints(
    filterOrgId?: string,
    range: "7d" | "30d" = "7d",
    activeAlertsOnly?: boolean
  ): Promise<MapPoint[]> {
    // Default to 7 days if not specified - MVP spec requirement
    const days = range === "30d" ? 30 : 7;
    const startDate = subDays(new Date(), days);

    const conditions = [];
    const baseFilter = this.getOrgFilter();
    if (baseFilter) conditions.push(baseFilter);

    if (this.userRole === "super_admin" && filterOrgId) {
      conditions.push(eq(reports.orgId, filterOrgId));
    }

    // Time window filter - strict date filtering per MVP spec
    conditions.push(gte(reports.createdAt, startDate));
    // Optional: exclude future-dated timestamps
    conditions.push(lte(reports.createdAt, new Date()));

    // Location must not be null
    conditions.push(sql`${reports.location} is not null`);

    // Do NOT filter by severity here - activeAlertsOnly is applied after collapsing
    // so we only show locations whose *latest* state is HIGH/WARNING.

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch all reports within time window, ordered by date descending
    const reportResults = await this.database.query.reports.findMany({
      where: whereClause,
      with: {
        user: true,
      },
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
      limit: 500,
    });

    // Group reports by 4dp location bucket (same trap ~11m)
    type ReportRow = (typeof reportResults)[number];
    const locationGroups = new Map<string, ReportRow[]>();

    for (const report of reportResults) {
      const bucket = parseLocationBucket(report.location);
      if (!bucket) continue;
      if (!locationGroups.has(bucket.key)) {
        locationGroups.set(bucket.key, []);
      }
      locationGroups.get(bucket.key)!.push(report);
    }

    const mapPoints: MapPoint[] = [];

    for (const [locationKey, locationReports] of locationGroups) {
      locationReports.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      const latestReport = locationReports[0]!;
      const bucket = parseLocationBucket(latestReport.location);
      if (!bucket) continue;

      // Apply activeAlertsOnly after collapsing: only include if latest state is HIGH or WARNING
      if (activeAlertsOnly) {
        const sev = latestReport.severity;
        if (sev !== "HIGH" && sev !== "WARNING") continue;
      }

      const recentHistory = locationReports.slice(1, 6).map((r) => ({
        id: r.id,
        pest: r.label || "Unknown",
        severity: r.severity,
        count: r.observedCount,
        date: r.createdAt,
        officerName: r.user?.fullName || r.user?.phoneNumber || "Unknown",
      }));

      mapPoints.push({
        id: latestReport.id,
        lat: bucket.lat,
        lon: bucket.lon,
        pest: latestReport.label || "Unknown",
        severity: latestReport.severity,
        count: latestReport.observedCount,
        date: latestReport.createdAt,
        officerName:
          latestReport.user?.fullName ||
          latestReport.user?.phoneNumber ||
          "Unknown",
        locationKey,
        location: latestReport.location ?? locationKey,
        recency: this.getRecency(latestReport.createdAt),
        recentHistory,
      });
    }

    return mapPoints;
  }
}

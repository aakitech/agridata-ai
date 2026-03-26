import { db } from "~/server/db";
import { reports, appUsers } from "~/server/db/schema";
import { eq, and, or, sql, desc, gte, lte, count } from "drizzle-orm";
import { subDays, differenceInDays } from "date-fns";
import {
  parseLocation,
  parseLocationBucket,
  haversineDistanceMeters,
  LOCATION_CLUSTER_RADIUS_METERS,
  formatLatLonKey,
} from "~/lib/geo";

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  pest: string | null;
  observationMethod?: string | null;
  severity: "HIGH" | "WARNING" | "NORMAL" | null;
  count: number | null;
  summaryValue?: string | null;
  secondaryValue?: string | null;
  date: Date;
  officerName: string;
  /** Stable bucket key for React keys and one-marker-per-location (e.g. "29.1234,-19.5678") */
  locationKey: string;
  /** Raw location WKT string from the latest report */
  location: string;
  recency: "fresh" | "recent" | "stale";
  recentHistory: Array<{
    id: string;
    pest: string | null;
    observationMethod?: string | null;
    severity: "HIGH" | "WARNING" | "NORMAL" | null;
    count: number | null;
    summaryValue?: string | null;
    secondaryValue?: string | null;
    date: Date;
    officerName: string;
  }>;
  weather?: WeatherSummary | null;
}

export interface WeatherSummary {
  status: "PENDING" | "OK" | "FAILED" | "NEEDS_REVIEW";
  qualityFlag: "UNKNOWN" | "PLAUSIBLE" | "SUSPECT";
  source: string | null;
  observedLocalDate: string;
  fetchedAt: Date | null;
  observedAt: Date | null;
  rainfallMm: number | null;
  relativeHumidityPct: number | null;
  minTempC: number | null;
  maxTempC: number | null;
  avgTempC: number | null;
  rainDayMm: number | null;
  rain7dMm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  tempMeanC: number | null;
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

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private mapWeatherSummary(weather: {
    status: "PENDING" | "OK" | "FAILED" | "NEEDS_REVIEW";
    qualityFlag: "UNKNOWN" | "PLAUSIBLE" | "SUSPECT";
    source: string | null;
    observedLocalDate: string;
    fetchedAt: Date | null;
    observedAt: Date;
    rainDayMm: unknown;
    rain7dMm: unknown;
    tempMinC: unknown;
    tempMaxC: unknown;
    tempMeanC: unknown;
    relativeHumidityPct: unknown;
  } | null | undefined): WeatherSummary | null {
    if (!weather) return null;
    const rainDayMm = this.toNumberOrNull(weather.rainDayMm);
    const tempMinC = this.toNumberOrNull(weather.tempMinC);
    const tempMaxC = this.toNumberOrNull(weather.tempMaxC);
    const tempMeanC = this.toNumberOrNull(weather.tempMeanC);
    const relativeHumidityPct = this.toNumberOrNull(weather.relativeHumidityPct);
    return {
      status: weather.status,
      qualityFlag: weather.qualityFlag,
      source: weather.source ?? null,
      observedLocalDate: weather.observedLocalDate,
      fetchedAt: weather.fetchedAt ?? null,
      observedAt: weather.observedAt ?? null,
      rainfallMm: rainDayMm,
      relativeHumidityPct,
      minTempC: tempMinC,
      maxTempC: tempMaxC,
      avgTempC: tempMeanC,
      rainDayMm,
      rain7dMm: this.toNumberOrNull(weather.rain7dMm),
      tempMinC,
      tempMaxC,
      tempMeanC,
    };
  }

  private getReportPayload(
    report: { dataPayload: unknown } | { dataPayload?: unknown }
  ): Record<string, unknown> | null {
    if (!report.dataPayload || typeof report.dataPayload !== "object") return null;
    return report.dataPayload as Record<string, unknown>;
  }

  private getReportPestLabel(
    report: { label: string | null; pestKey?: string | null; dataPayload?: unknown }
  ): string {
    const payload = this.getReportPayload(report);
    const meta = payload?.meta as Record<string, unknown> | undefined;
    return (
      report.label ??
      (typeof meta?.pestLabel === "string" ? meta.pestLabel : null) ??
      report.pestKey ??
      (typeof meta?.pestKey === "string" ? meta.pestKey : null) ??
      "Unknown"
    );
  }

  private getReportObservationMethod(
    report: { observationMethod?: string | null; dataPayload?: unknown }
  ): string | null {
    const payload = this.getReportPayload(report);
    const meta = payload?.meta as Record<string, unknown> | undefined;
    return (
      report.observationMethod ??
      (typeof meta?.observationMethod === "string" ? meta.observationMethod : null) ??
      null
    );
  }

  private getReportSummaryValue(
    report: {
      observedCount: number | null;
      pestKey?: string | null;
      label?: string | null;
      dataPayload?: unknown;
    }
  ): string | null {
    if (report.observedCount !== null && report.observedCount !== undefined) {
      return String(report.observedCount);
    }

    const payload = this.getReportPayload(report);
    const raw = payload?.raw;
    if (raw && typeof raw === "object") {
      const rawRecord = raw as Record<string, unknown>;
      const pestKey = report.pestKey ?? null;

      if (pestKey === "locusts") {
        const eventScale = rawRecord.event_scale;
        if (typeof eventScale === "string" && eventScale.trim() !== "") {
          return `Estimated size: ${eventScale}`;
        }
      }

      if (pestKey === "quelea_birds") {
        const flockSizeBand = rawRecord.flock_size_band;
        if (typeof flockSizeBand === "string" && flockSizeBand.trim() !== "") {
          return `Estimated flock size: ${flockSizeBand.replace(/_/g, "-")}`;
        }
      }

      const rawValues = Object.values(raw as Record<string, unknown>);
      const firstUseful = rawValues.find(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      );
      if (firstUseful !== undefined) {
        return String(firstUseful);
      }
    }

    const derived = payload?.derived;
    if (derived && typeof derived === "object") {
      const derivedEntry = Object.entries(derived as Record<string, unknown>).find(
        ([, value]) => value !== null && value !== undefined && value !== ""
      );
      if (derivedEntry) {
        const [key, value] = derivedEntry;
        return `${key}: ${String(value)}`;
      }
    }

    return null;
  }

  private getReportSecondaryValue(
    report: { pestKey?: string | null; dataPayload?: unknown }
  ): string | null {
    const payload = this.getReportPayload(report);
    const raw =
      payload?.raw && typeof payload.raw === "object"
        ? (payload.raw as Record<string, unknown>)
        : null;

    if (!raw) return null;

    if (report.pestKey === "locusts") {
      const details: string[] = [];

      if (typeof raw.movement_direction === "string" && raw.movement_direction.trim() !== "") {
        details.push(`Heading ${raw.movement_direction}`);
      }

      if (typeof raw.behavior === "string" && raw.behavior.trim() !== "") {
        details.push(raw.behavior);
      }

      return details.length > 0 ? details.join(" • ") : null;
    }

    if (report.pestKey === "quelea_birds") {
      const details: string[] = [];

      if (typeof raw.behavior === "string" && raw.behavior.trim() !== "") {
        details.push(raw.behavior);
      }

      if (typeof raw.crop_stage === "string" && raw.crop_stage.trim() !== "") {
        details.push(`Crop stage: ${raw.crop_stage}`);
      }

      return details.length > 0 ? details.join(" • ") : null;
    }

    return null;
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
        name: sql<string>`coalesce(${reports.label}, ${reports.pestKey}, 'Unknown')`,
        count: count(),
      })
      .from(reports)
      .where(whereClause)
      .groupBy(sql`coalesce(${reports.label}, ${reports.pestKey}, 'Unknown')`)
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

    const recentReports = await this.database.query.reports.findMany({
      where: whereClause,
      with: {
        organization: true,
        user: true,
      },
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
      limit: limit,
    });

    return recentReports.map((report) => ({
      ...report,
      displayLabel: this.getReportPestLabel(report),
      summaryValue: this.getReportSummaryValue(report),
      secondaryValue: this.getReportSecondaryValue(report),
    }));
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
        weather: true,
      },
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
      limit: 500,
    });

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

    const points: MapPoint[] = [];

    for (const [locationKey, locationReports] of locationGroups) {
      locationReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = locationReports[0]!;
      const bucket = parseLocationBucket(latest.location);
      if (!bucket) continue;

      // Apply activeAlertsOnly after collapsing: only include if latest state is HIGH or WARNING
      if (activeAlertsOnly) {
        const sev = latest.severity;
        if (sev !== "HIGH" && sev !== "WARNING") continue;
      }

      const recentHistory = locationReports
        .slice(1, 6)
        .map((r) => ({
          id: r.id,
          pest: this.getReportPestLabel(r),
          observationMethod: this.getReportObservationMethod(r),
          severity: r.severity,
          count: r.observedCount,
          summaryValue: this.getReportSummaryValue(r),
          secondaryValue: this.getReportSecondaryValue(r),
          date: r.createdAt,
          officerName: r.user?.fullName || r.user?.phoneNumber || "Unknown",
        }));

      points.push({
        id: latest.id,
        lat: bucket.lat,
        lon: bucket.lon,
        pest: this.getReportPestLabel(latest),
        observationMethod: this.getReportObservationMethod(latest),
        severity: latest.severity,
        count: latest.observedCount,
        summaryValue: this.getReportSummaryValue(latest),
        secondaryValue: this.getReportSecondaryValue(latest),
        date: latest.createdAt,
        officerName: latest.user?.fullName || latest.user?.phoneNumber || "Unknown",
        locationKey,
        location: latest.location ?? "",
        recency: this.getRecency(latest.createdAt),
        recentHistory,
        weather: this.mapWeatherSummary(latest.weather),
      });
    }

    // Sort by most recent activity (latest-state semantics)
    points.sort((a, b) => b.date.getTime() - a.date.getTime());

    return points;
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
        conditions.push(sql`${reports.label} is null and ${reports.pestKey} is null`);
      } else {
        conditions.push(or(eq(reports.label, pest), eq(reports.pestKey, pest)));
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
      reports: reportResults.map((report) => ({
        ...report,
        displayLabel: this.getReportPestLabel(report),
        observationMethodLabel: this.getReportObservationMethod(report),
        summaryValue: this.getReportSummaryValue(report),
        secondaryValue: this.getReportSecondaryValue(report),
      })),
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
        conditions.push(sql`${reports.label} is null and ${reports.pestKey} is null`);
      } else {
        conditions.push(or(eq(reports.label, pest), eq(reports.pestKey, pest)));
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
        weather: true,
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
          summaryValue: this.getReportSummaryValue(latest),
          secondaryValue: this.getReportSecondaryValue(latest),
          pest: this.getReportPestLabel(latest),
          observationMethod: this.getReportObservationMethod(latest),
          officer: latest.user?.fullName || latest.user?.phoneNumber || "Unknown",
          weather: this.mapWeatherSummary(latest.weather),
        },
        trend,
        reports: groupReports.map((r) => ({
          id: r.id,
          date: r.createdAt,
          severity: r.severity,
          count: r.observedCount,
          summaryValue: this.getReportSummaryValue(r),
          secondaryValue: this.getReportSecondaryValue(r),
          pest: this.getReportPestLabel(r),
          observationMethod: this.getReportObservationMethod(r),
          officer: r.user?.fullName || r.user?.phoneNumber || "Unknown",
          description: r.description,
          weather: this.mapWeatherSummary(r.weather),
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
  displayLabel: string;
  observationMethodLabel: string | null;
  observedCount: number | null;
  summaryValue: string | null;
  secondaryValue?: string | null;
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
    summaryValue?: string | null;
    secondaryValue?: string | null;
    pest: string;
    observationMethod?: string | null;
    officer: string;
    weather?: WeatherSummary | null;
  };
  trend: "up" | "down" | "stable";
  reports: Array<{
    id: string;
    date: Date;
    severity: "NORMAL" | "WARNING" | "HIGH" | null;
    count: number | null;
    summaryValue?: string | null;
    secondaryValue?: string | null;
    pest: string;
    observationMethod?: string | null;
    officer: string;
    description: string | null;
    weather?: WeatherSummary | null;
  }>;
}

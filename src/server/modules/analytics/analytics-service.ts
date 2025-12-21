import { db } from "~/server/db";
import { reports, appUsers } from "~/server/db/schema";
import { eq, and, sql, desc, gte, lte, count } from "drizzle-orm";
import { subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";

export class AnalyticsService {
  constructor(private database: typeof db, private orgId: string | undefined, private userRole: "super_admin" | "admin" | "officer") {}

  private getOrgFilter() {
    if (this.userRole === "super_admin") {
      return undefined; // No filter by default, unless specified in method
    }
    return eq(reports.orgId, this.orgId!);
  }

  // Combine base filter with optional dynamic filter
  private getCombinedFilter(filterOrgId?: string) {
      const conditions = [];
      const baseFilter = this.getOrgFilter();
      if (baseFilter) conditions.push(baseFilter);

      // If Super Admin and passed a specific org filter
      if (this.userRole === "super_admin" && filterOrgId) {
          conditions.push(eq(reports.orgId, filterOrgId));
      }
      
      return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async getStats(filterOrgId?: string) {
    const whereClause = this.getCombinedFilter(filterOrgId);
    
    // Total Reports
    const [totalReports] = await this.database
      .select({ count: count() })
      .from(reports)
      .where(whereClause);

    // Reports this week
    const startOfCurrentWeek = startOfWeek(new Date());
    const [weekReports] = await this.database
        .select({ count: count() })
        .from(reports)
        .where(whereClause ? and(whereClause, gte(reports.createdAt, startOfCurrentWeek)) : gte(reports.createdAt, startOfCurrentWeek));

    // Reports last week (for trend)
    const startOfLastWeek = startOfWeek(subWeeks(new Date(), 1));
    const endOfLastWeek = endOfWeek(subWeeks(new Date(), 1));
    const [lastWeekReports] = await this.database
        .select({ count: count() })
        .from(reports)
        .where(
            whereClause 
            ? and(whereClause, gte(reports.createdAt, startOfLastWeek), lte(reports.createdAt, endOfLastWeek)) 
            : and(gte(reports.createdAt, startOfLastWeek), lte(reports.createdAt, endOfLastWeek))
        );

    // Active Scouts (Unique Users)
    // Note: Drizzle's count(distinct) might need raw SQL or specific syntax depending on driver
    const activeScoutsQuery = this.database
        .select({ count: count(reports.userId) }) // Approximation, ideally distinct
        .from(reports)
        .where(whereClause);
        
    // For precise distinct count with Drizzle/Postgres:
    const [activeScouts] = await this.database.select({ value: sql<number>`count(distinct ${reports.userId})` })
        .from(reports)
        .where(whereClause);


    // Risk Overview (High Risk Count)
    const [highRisk] = await this.database
        .select({ count: count() })
        .from(reports)
        .where(
            whereClause 
            ? and(whereClause, eq(reports.riskLevel, "HIGH")) 
            : eq(reports.riskLevel, "HIGH")
        );

    return {
        totalReports: totalReports?.count ?? 0,
        reportsThisWeek: weekReports?.count ?? 0,
        reportsLastWeek: lastWeekReports?.count ?? 0,
        activeScouts: activeScouts?.value ?? 0,
        highRiskCount: highRisk?.count ?? 0,
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

  async getPestDistribution(filterOrgId?: string) {
      const whereClause = this.getCombinedFilter(filterOrgId);

      // Group by Diagnosis (Verified reports only ideally, or all?)
      // Let's rely on verified diagnosis primarily, or fallback to category/label?
      // Spec says "Pest Distribution".
      
      const distribution = await this.database
        .select({
            name: reports.diagnosis,
            count: count(),
        })
        .from(reports)
        .where(
            whereClause 
            ? and(whereClause, eq(reports.status, "VERIFIED")) // Only confirmed pests
            : eq(reports.status, "VERIFIED")
        )
        .groupBy(reports.diagnosis)
        .orderBy(desc(count()))
        .limit(5);

      return distribution;
  }

  async getRecentReports(limit: number = 5, filterOrgId?: string) {
      const whereClause = this.getCombinedFilter(filterOrgId);

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

  async getMapPoints(filterOrgId?: string) {
      const whereClause = this.getCombinedFilter(filterOrgId);

      // Fetch reports with locations
      const results = await this.database
        .select({
            id: reports.id,
            location: reports.location,
            diagnosis: reports.diagnosis,
            riskLevel: reports.riskLevel,
        })
        .from(reports)
        .where(
            whereClause 
            ? and(whereClause, sql`${reports.location} is not null`) 
            : sql`${reports.location} is not null`
        )
        .limit(100); // Limit for performance on overview

      return results.map(r => {
          const coordinates = r.location?.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
          return {
              id: r.id,
              lat: coordinates ? parseFloat(coordinates[2]!) : null,
              lon: coordinates ? parseFloat(coordinates[1]!) : null,
              diagnosis: r.diagnosis,
              riskLevel: r.riskLevel
          };
      }).filter(p => p.lat !== null && p.lon !== null);
  }
}

import type { reports, appUsers, organizations } from "~/server/db/schema";

export type ReportWithRelations = typeof reports.$inferSelect & {
  user: typeof appUsers.$inferSelect | null;
  organization: typeof organizations.$inferSelect | null;
  geocodedLocation?: string | null;
};

export interface MpbcReportData {
  organization: {
    id: string;
    name: string;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
  summaryMetrics: {
    totalReports: number;
    activeOfficers: number;
    uniqueLocations: number;
    highAlertCount: number;
  };
  highAlertReports: ReportWithRelations[];
  allReports: ReportWithRelations[];
  mapPoints: Array<{
    lat: number;
    lon: number;
    severity: "NORMAL" | "WARNING" | "HIGH" | null;
  }>;
  provinceBreakdown: Array<{
    province: string;
    totalReports: number;
    locations: number;
    highAlerts: number;
    warningAlerts: number;
    normalAlerts: number;
    sharePercentage: number;
  }>;
}


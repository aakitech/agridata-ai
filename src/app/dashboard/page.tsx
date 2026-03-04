"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { StatsCards } from "./_components/stats-cards";
import { TrendChart } from "./_components/trend-chart";
import { RecentActivity } from "./_components/recent-activity";
import { GenerateReportButton } from "./_components/generate-report-button";
import { ProvinceBreakdown } from "./_components/province-breakdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Loader2, AlertCircle, Bell } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import dynamic from "next/dynamic";
import { withMockWeatherList } from "~/lib/mock-weather";

const DashboardMap = dynamic(() => import("./_components/dashboard-map").then(mod => mod.DashboardMap), { 
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center">Loading Map...</div>
});

export default function DashboardPage() {
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [activeAlertsOnly, setActiveAlertsOnly] = useState(false);

  // Fetch Current User
  const { data: me } = api.users.getMe.useQuery();

  // Fetch Stats - Refresh every 60 seconds (aggregates change less frequently)
  const { data: stats, isLoading: statsLoading } = api.analytics.getStats.useQuery(
    { filterOrgId, range },
    { refetchInterval: 60000, refetchOnWindowFocus: true }
  );
  
  // Fetch Trends - Refresh every 120 seconds (historical data, less critical)
  const { data: trends, isLoading: trendsLoading } = api.analytics.getReportsOverTime.useQuery(
    { range, filterOrgId },
    { refetchInterval: 120000, refetchOnWindowFocus: true }
  );
  
  // Fetch Recent Activity - Refresh every 30 seconds (most critical for new reports)
  const { data: activity, isLoading: activityLoading } = api.analytics.getRecentActivity.useQuery(
    { limit: 5, filterOrgId, range },
    { refetchInterval: 30000, refetchOnWindowFocus: true }
  );
  
  // Fetch Map Points - Refresh every 120 seconds (less critical, reduces load)
  // Per MVP spec: supports activeAlertsOnly toggle and 7-day default window
  const { data: mapPoints, isLoading: mapLoading } = api.analytics.getMapPoints.useQuery(
    { filterOrgId, range, activeAlertsOnly },
    { refetchInterval: 120000, refetchOnWindowFocus: true }
  );
  
  // Fetch Location Breakdown (for province aggregation)
  const locationStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (range === "30d" ? 30 : 7));
    return d;
  }, [range]);

  const { data: locationData } = api.analytics.getReportsByLocation.useQuery(
    { orgId: filterOrgId, startDate: locationStartDate },
    { refetchInterval: 120000, refetchOnWindowFocus: true }
  );

  // Fetch Orgs (for filter)
  const { data: orgs } = api.organizations.getAll.useQuery();

  const isLoading = statsLoading || trendsLoading || activityLoading || mapLoading;
  const weatherAwareMapPoints = useMemo(() => withMockWeatherList(mapPoints as any), [mapPoints]);

  if (isLoading && !stats) {
      return (
          <div className="flex items-center justify-center h-[50vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading Analytics...</span>
          </div>
      );
  }

  return (
    <div className="space-y-8 p-1 sm:p-2 animate-in fade-in duration-500 overflow-x-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
                Operational overview of reports and alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex flex-1 items-center gap-1.5 bg-muted/30 p-1 rounded-lg border shadow-sm overflow-hidden min-w-[200px] md:min-w-0">
                {/* Org Filter (Only show for super_admin) */}
                {me?.role === "super_admin" && orgs && orgs.length > 0 && (
                  <Select value={filterOrgId ?? "all"} onValueChange={(val) => setFilterOrgId(val === "all" ? undefined : val)}>
                      <SelectTrigger className="flex-1 md:w-[160px] h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs">
                          <SelectValue placeholder="Org" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Organizations</SelectItem>
                          {orgs.map((org) => (
                              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                )}

                {me?.role !== "super_admin" && me?.organization && (
                    <Badge variant="secondary" className="h-7 px-2 text-[10px] font-bold whitespace-nowrap">
                        {me.organization.name}
                    </Badge>
                )}

                <div className="w-[1px] h-4 bg-border mx-0.5" />

                <Select value={range} onValueChange={(val) => setRange(val as "7d" | "30d")}>
                    <SelectTrigger className="flex-1 md:w-[110px] h-8 border-none bg-transparent shadow-none focus:ring-0 text-xs">
                        <SelectValue placeholder="Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                    </SelectContent>
                </Select>
              </div>

              {/* Generate Report Button (MPBC only) */}
              {me && (
                <GenerateReportButton
                  orgId={
                    me.role === "super_admin" && filterOrgId
                      ? filterOrgId
                      : me.organization?.id
                  }
                  orgSlug={
                    me.role === "super_admin" && filterOrgId
                      ? orgs?.find((o) => o.id === filterOrgId)?.slug
                      : me.organization?.slug
                  }
                  userRole={me.role}
                  range={range}
                />
              )}
          </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCards stats={stats} />
        </div>
      )}

      {/* Top Row: Map & Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <div className="lg:col-span-2 flex flex-col gap-2">
            {/* Map Controls - MVP spec 7.2: Active Alerts Toggle */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {mapPoints ? `${mapPoints.length} location${mapPoints.length !== 1 ? 's' : ''} shown` : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="active-alerts"
                  checked={activeAlertsOnly}
                  onCheckedChange={setActiveAlertsOnly}
                />
                <Label htmlFor="active-alerts" className="text-sm cursor-pointer">
                  Active alerts only
                </Label>
              </div>
            </div>
            
            <div className="h-[450px]">
              {mapPoints ? (
                  <DashboardMap points={weatherAwareMapPoints as any} />
              ) : (
                  <div className="h-full w-full bg-muted rounded-xl flex items-center justify-center animate-pulse">Map Loading...</div>
              )}
            </div>
         </div>

         <div className="bg-card border rounded-xl overflow-hidden h-[450px]">
            {activity && <RecentActivity reports={activity as any} />}
         </div>
      </div>

      {/* Province Breakdown */}
      {locationData && locationData.length > 0 && (
        <ProvinceBreakdown locations={locationData} />
      )}

      {/* Analytics Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {trends && <div className="col-span-full bg-card border rounded-xl p-6 shadow-sm"> <TrendChart data={trends} /> </div>}
      </div>
    </div>
  );
}

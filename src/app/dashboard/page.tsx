"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { StatsCards } from "./_components/stats-cards";
import { TrendChart } from "./_components/trend-chart";
import { PestDistribution } from "./_components/pest-distribution";
import { RecentActivity } from "./_components/recent-activity";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import dynamic from "next/dynamic";

const DashboardMap = dynamic(() => import("./_components/dashboard-map").then(mod => mod.DashboardMap), { 
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center">Loading Map...</div>
});

export default function DashboardPage() {
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<"7d" | "30d">("7d");

  // Fetch Current User
  const { data: me } = api.users.getMe.useQuery();

  // Fetch Stats
  const { data: stats, isLoading: statsLoading } = api.analytics.getStats.useQuery({ filterOrgId });
  // Fetch Trends
  const { data: trends, isLoading: trendsLoading } = api.analytics.getReportsOverTime.useQuery({ 
      range, 
      filterOrgId 
  });
  // Fetch Distribution
  const { data: distribution, isLoading: distributionLoading } = api.analytics.getPestDistribution.useQuery({ filterOrgId });
  // Fetch Recent Activity
  const { data: activity, isLoading: activityLoading } = api.analytics.getRecentActivity.useQuery({ 
      limit: 5, 
      filterOrgId 
  });
  // Fetch Map Points
  const { data: mapPoints, isLoading: mapLoading } = api.analytics.getMapPoints.useQuery({ filterOrgId });
  
  // Fetch Orgs (for filter)
  const { data: orgs } = api.organizations.getAll.useQuery();

  const isLoading = statsLoading || trendsLoading || distributionLoading || activityLoading || mapLoading;

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
                Geographic and statistical overview of crop reports.
            </p>
          </div>

          <div className="flex items-center gap-2">
              {/* Org Filter (Only show for super_admin) */}
              {me?.role === "super_admin" && orgs && orgs.length > 0 && (
                <Select value={filterOrgId ?? "all"} onValueChange={(val) => setFilterOrgId(val === "all" ? undefined : val)}>
                    <SelectTrigger className="w-[180px] sm:w-[200px] h-9">
                        <SelectValue placeholder="All Organizations" />
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
                  <Badge variant="outline" className="h-9 px-3 text-sm font-normal">
                      {me.organization.name}
                  </Badge>
              )}

              <Select value={range} onValueChange={(val) => setRange(val as "7d" | "30d")}>
                  <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
              </Select>
          </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCards stats={stats} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trends && <TrendChart data={trends} />}
        {distribution && <PestDistribution data={distribution} />}
      </div>
      
      {/* Bottom Row: Recent Activity & Map */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
         <div className="lg:col-span-2 h-[450px]">
            {mapPoints ? (
                <DashboardMap points={mapPoints as any} />
            ) : (
                <div className="h-full w-full bg-muted rounded-xl flex items-center justify-center animate-pulse">Map Loading...</div>
            )}
         </div>

         <div className="bg-card border rounded-xl p-4 h-[450px] overflow-y-auto">
            {activity && <RecentActivity reports={activity as any} />}
         </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { ViewToggle } from "./_components/view-toggle";
import { TimeRangeSelector } from "./_components/time-range-selector";
import { GroupedView } from "./_components/grouped-view";
import { ListView } from "./_components/list-view";
import { FilterBar } from "./_components/filter-bar";
import { Loader2, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { subDays } from "date-fns";
import type { LocationWithReports } from "~/server/modules/analytics/analytics-service";

type ViewMode = "grouped" | "list";
type TimeRange = "7d" | "30d" | "90d" | "all";

export default function ReportsPage() {
  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "HIGH" | "WARNING" | "NORMAL">("ALL");
  const [officerFilter, setOfficerFilter] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);

  // Load persisted view mode
  useEffect(() => {
    const saved = localStorage.getItem("agridata-reports-view") as ViewMode | null;
    if (saved && (saved === "grouped" || saved === "list")) {
      setViewMode(saved);
    }
  }, []);

  // Save view mode when changed
  useEffect(() => {
    localStorage.setItem("agridata-reports-view", viewMode);
  }, [viewMode]);

  // Calculate date range - memoized to prevent unnecessary re-fetches
  const startDate = useMemo(() => {
    switch (timeRange) {
      case "7d": return subDays(new Date(), 7);
      case "30d": return subDays(new Date(), 30);
      case "90d": return subDays(new Date(), 90);
      case "all": return undefined;
    }
  }, [timeRange]);

  // Fetch data based on view mode - GROUPED VIEW
  const {
    data: groupedData,
    isLoading: groupedLoading,
    error: groupedError,
    isError: isGroupedError,
    refetch: refetchGrouped,
  } = api.analytics.getReportsByLocation.useQuery(
    {
      startDate,
      severity: severityFilter === "ALL" ? undefined : severityFilter,
      officerId: officerFilter ?? undefined,
      orgId: orgFilter ?? undefined,
    },
    {
      enabled: viewMode === "grouped",
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 2,
    }
  );

  // Fetch data based on view mode - LIST VIEW
  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
    isError: isListError,
    refetch: refetchList,
  } = api.analytics.getAllReports.useQuery(
    {
      startDate,
      severity: severityFilter === "ALL" ? undefined : severityFilter,
      officerId: officerFilter ?? undefined,
      orgId: orgFilter ?? undefined,
      page: 1,
      limit: 25,
    },
    {
      enabled: viewMode === "list",
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 2,
    }
  );

  // Get current user for permissions
  const { data: me } = api.users.getMe.useQuery();
  const { data: orgs } = api.organizations.getAll.useQuery();

  // Combined loading and error states
  const isLoading = viewMode === "grouped" ? groupedLoading : listLoading;
  const isError = viewMode === "grouped" ? isGroupedError : isListError;
  const error = viewMode === "grouped" ? groupedError : listError;
  const refetch = viewMode === "grouped" ? refetchGrouped : refetchList;

  // Calculate total reports count
  const totalReports = viewMode === "grouped" 
    ? groupedData?.reduce((acc: number, loc: LocationWithReports) => acc + loc.reportCount, 0) ?? 0
    : listData?.pagination.total ?? 0;

  // Error display component
  const ErrorDisplay = ({ error, onRetry }: { error: Error | null; onRetry: () => void }) => {
    if (!error) return null;
    
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="p-4 bg-red-50 rounded-full">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-700">Failed to load reports</h3>
            <p className="text-sm text-red-600 mt-1">
              {error.message || "An unexpected error occurred while fetching reports."}
            </p>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  };

  // Empty state component
  const EmptyDisplay = () => (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="p-4 bg-gray-50 rounded-full">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-700">No reports found</h3>
          <p className="text-sm text-gray-500 mt-1">
            No reports match your current filters. Try adjusting the time range or filters.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4 p-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground text-sm">
              {isLoading ? "Loading..." : isError ? "Error loading reports" : `${totalReports} reports in selected range`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle */}
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          
          {/* Time Range */}
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        severity={severityFilter}
        onSeverityChange={setSeverityFilter}
        officerId={officerFilter}
        onOfficerChange={setOfficerFilter}
        orgId={orgFilter}
        onOrgChange={setOrgFilter}
        organizations={orgs}
        userRole={me?.role}
        userOrgId={me?.organization?.id}
      />

      {/* Error Display */}
      {isError && <ErrorDisplay error={error as Error | null} onRetry={refetch} />}

      {/* Loading State */}
      {!isError && isLoading && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading reports...</span>
        </div>
      )}

      {/* Main Content */}
      {!isError && !isLoading && (
        <div className="flex-1 min-h-0">
          {viewMode === "grouped" ? (
            groupedData && groupedData.length > 0 ? (
              <GroupedView
                locations={groupedData}
                selectedLocationKey={selectedLocationKey}
                onSelectLocation={setSelectedLocationKey}
              />
            ) : (
              <EmptyDisplay />
            )
          ) : (
            listData && listData.reports.length > 0 ? (
              <ListView
                reports={listData.reports}
                pagination={listData.pagination}
              />
            ) : (
              <EmptyDisplay />
            )
          )}
        </div>
      )}
    </div>
  );
}

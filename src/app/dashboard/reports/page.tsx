"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { ViewToggle } from "./_components/view-toggle";
import { TimeRangeSelector } from "./_components/time-range-selector";
import { GroupedView } from "./_components/grouped-view";
import { ListView } from "./_components/list-view";
import { FilterBar } from "./_components/filter-bar";
import { Button } from "~/components/ui/button";
import { Loader2, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { subDays } from "date-fns";
import type { LocationWithReports } from "~/server/modules/analytics/analytics-service";
import { LOCATION_CLUSTER_RADIUS_METERS } from "~/lib/geo";
import { withMockWeatherLocations } from "~/lib/mock-weather";

type ViewMode = "grouped" | "list";
type TimeRange = "7d" | "30d" | "90d" | "all";
type ListSort = "DATE_DESC" | "DATE_ASC";

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "HIGH" | "WARNING" | "NORMAL">("ALL");
  const [officerFilter, setOfficerFilter] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [pestFilter, setPestFilter] = useState<string | null>(null);
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showGroupedHelper, setShowGroupedHelper] = useState(true);

  // Read province from URL param on mount
  useEffect(() => {
    const province = searchParams.get("province");
    if (province) {
      setProvinceFilter(province);
      // Switch to grouped view when filtering by province (locations are spatial)
      setViewMode("grouped");
    }
  }, [searchParams]);

  // Update URL when province filter changes
  const handleProvinceChange = useCallback((value: string | null) => {
    setProvinceFilter(value);
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set("province", value);
    } else {
      params.delete("province");
    }
    const qs = params.toString();
    router.replace(`/dashboard/reports${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  // List controls
  const [page, setPage] = useState(1);
  const [listSort, setListSort] = useState<ListSort>("DATE_DESC");

  // Load persisted view mode
  useEffect(() => {
    const saved = localStorage.getItem("agridata-reports-view") as ViewMode | null;
    if (saved && (saved === "grouped" || saved === "list")) {
      setViewMode(saved);
    }

    const helperDismissed = localStorage.getItem("agridata-reports-grouped-helper-dismissed");
    if (helperDismissed === "true") {
      setShowGroupedHelper(false);
    }
  }, []);

  // Save view mode when changed
  useEffect(() => {
    localStorage.setItem("agridata-reports-view", viewMode);
  }, [viewMode]);

  const dismissGroupedHelper = () => {
    setShowGroupedHelper(false);
    localStorage.setItem("agridata-reports-grouped-helper-dismissed", "true");
  };

  // Reset list pagination when key inputs change
  useEffect(() => {
    setPage(1);
  }, [timeRange, severityFilter, officerFilter, orgFilter, pestFilter, provinceFilter, listSort, viewMode, search]);

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
      pest: pestFilter ?? undefined,
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
      pest: pestFilter ?? undefined,
      page,
      limit: 25,
      sort: listSort,
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
  const { data: users } = api.users.getAll.useQuery();
  const { data: orgs } = api.organizations.getAll.useQuery();

  const officers = useMemo(
    () =>
      users
        ?.filter((u) => u.role === "officer")
        .map((u) => ({ id: u.id, fullName: u.fullName, phoneNumber: u.phoneNumber })),
    [users]
  );

  const pestOptions = useMemo(() => {
    const set = new Set<string>();
    let sawUnknown = false;

    for (const loc of groupedData ?? []) {
      for (const r of loc.reports) {
        if (!r.pest || r.pest === "Unknown") {
          sawUnknown = true;
        } else {
          set.add(r.pest);
        }
      }
    }

    for (const r of listData?.reports ?? []) {
      if (!r.displayLabel || r.displayLabel === "Unknown") {
        sawUnknown = true;
      } else {
        set.add(r.displayLabel);
      }
    }

    const pests = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (sawUnknown) pests.unshift("__unknown__");
    return pests;
  }, [groupedData, listData?.reports]);

  // Province resolution: geocode unique coordinates from grouped data to extract province names
  const uniqueCoords = useMemo(() => {
    if (!groupedData) return [];
    const map = new Map<string, { lat: number; lon: number }>();
    for (const loc of groupedData) {
      const key = `${loc.coordinates.lat.toFixed(3)},${loc.coordinates.lon.toFixed(3)}`;
      if (!map.has(key)) {
        map.set(key, loc.coordinates);
      }
    }
    return Array.from(map.entries());
  }, [groupedData]);

  // Imperative batch geocode using tRPC utils (avoids hooks-in-loop violation)
  const utils = api.useUtils();
  const [coordToProvince, setCoordToProvince] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (uniqueCoords.length === 0) {
      setCoordToProvince(new Map());
      return;
    }

    let cancelled = false;

    async function resolveProvinces() {
      const map = new Map<string, string>();
      await Promise.all(
        uniqueCoords.map(async ([key, coords]) => {
          try {
            const result = await utils.reports.reverseGeocode.fetch(
              { lat: coords.lat, lon: coords.lon }
            );
            if (result && !cancelled) {
              map.set(key, result.state ?? result.county ?? "Unknown");
            }
          } catch {
            // ignore geocoding failures for individual coordinates
          }
        })
      );
      if (!cancelled) {
        setCoordToProvince(map);
      }
    }

    void resolveProvinces();
    return () => { cancelled = true; };
  }, [uniqueCoords, utils]);

  // Available province options for the filter dropdown
  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const province of coordToProvince.values()) {
      if (province !== "Unknown" && province !== "Resolving...") {
        set.add(province);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [coordToProvince]);

  // Helper: get province name for a location
  const getLocationProvince = useCallback((loc: LocationWithReports): string | null => {
    const key = `${loc.coordinates.lat.toFixed(3)},${loc.coordinates.lon.toFixed(3)}`;
    return coordToProvince.get(key) ?? null;
  }, [coordToProvince]);

  // Combined loading and error states
  const isLoading = viewMode === "grouped" ? groupedLoading : listLoading;
  const isError = viewMode === "grouped" ? isGroupedError : isListError;
  const error = viewMode === "grouped" ? groupedError : listError;
  const refetch = viewMode === "grouped" ? refetchGrouped : refetchList;

  // Calculate total reports count
  const totalReports = viewMode === "grouped" 
    ? groupedData?.reduce((acc: number, loc: LocationWithReports) => acc + loc.reportCount, 0) ?? 0
    : listData?.pagination.total ?? 0;

  const normalizedSearch = search.trim().toLowerCase();
  const weatherAwareGroupedData = useMemo<LocationWithReports[] | undefined>(
    () => withMockWeatherLocations(groupedData as any) as LocationWithReports[] | undefined,
    [groupedData]
  );

  const filteredGroupedData = useMemo(() => {
    if (!weatherAwareGroupedData) return weatherAwareGroupedData;

    let filtered = weatherAwareGroupedData;

    // Province filter
    if (provinceFilter) {
      filtered = filtered.filter((loc) => {
        const province = getLocationProvince(loc);
        return province === provinceFilter;
      });
    }

    // Search filter
    if (normalizedSearch) {
      filtered = filtered.filter((loc) => {
        const latest = loc.latestReport;
        return (
          latest.pest.toLowerCase().includes(normalizedSearch) ||
          latest.officer.toLowerCase().includes(normalizedSearch)
        );
      });
    }

    return filtered;
  }, [weatherAwareGroupedData, normalizedSearch, provinceFilter, getLocationProvince]);

  const filteredListReports = useMemo(() => {
    if (!listData?.reports) return listData?.reports;
    if (!normalizedSearch) return listData.reports;
    return listData.reports.filter((r) => {
      const officer = (r.user?.fullName || r.user?.phoneNumber || "").toLowerCase();
      const pest = (r.displayLabel || r.label || "").toLowerCase();
      return officer.includes(normalizedSearch) || pest.includes(normalizedSearch);
    });
  }, [listData?.reports, normalizedSearch]);

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
        viewMode={viewMode}
        severity={severityFilter}
        onSeverityChange={setSeverityFilter}
        officerId={officerFilter}
        onOfficerChange={setOfficerFilter}
        orgId={orgFilter}
        onOrgChange={setOrgFilter}
        organizations={orgs}
        officers={officers}
        userRole={me?.role}
        search={search}
        onSearchChange={setSearch}
        pest={pestFilter}
        onPestChange={setPestFilter}
        pestOptions={pestOptions}
        province={provinceFilter}
        onProvinceChange={handleProvinceChange}
        provinceOptions={provinceOptions}
        listSort={listSort}
        onListSortChange={setListSort}
      />

      {/* Grouped helper message */}
      {viewMode === "grouped" && showGroupedHelper && (
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Grouped view:</span>{" "}
            shows the latest status per location. Reports within ~{LOCATION_CLUSTER_RADIUS_METERS}m are combined.
            <span className="ml-1">Use List for a full chronological log.</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={dismissGroupedHelper}>
            Got it
          </Button>
        </div>
      )}

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
            filteredGroupedData && filteredGroupedData.length > 0 ? (
              <GroupedView
                locations={filteredGroupedData}
                selectedLocationKey={selectedLocationKey}
                onSelectLocation={setSelectedLocationKey}
              />
            ) : (
              <EmptyDisplay />
            )
          ) : (
            listData && filteredListReports && filteredListReports.length > 0 ? (
              <ListView
                reports={filteredListReports}
                pagination={listData.pagination}
                onPageChange={setPage}
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

"use client";
import { MapPin, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import type { LocationWithReports } from "~/server/modules/analytics/analytics-service";
import { LocationDetail } from "./location-detail";

interface GroupedViewProps {
  locations: LocationWithReports[];
  selectedLocationKey: string | null;
  onSelectLocation: (key: string) => void;
}

function LocationNameDisplay({ coordinates }: { coordinates: { lat: number; lon: number } }) {
  const { data: addressData } = api.reports.reverseGeocode.useQuery(
    { lat: coordinates.lat, lon: coordinates.lon },
    { enabled: true, staleTime: Infinity }
  );

  if (!addressData) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)}
      </span>
    );
  }

  const parts = [
    addressData.road,
    addressData.neighborhood,
    addressData.suburb,
    addressData.village,
    addressData.town,
    addressData.city,
    addressData.county,
    addressData.state,
  ].filter(Boolean) as string[];

  const uniqueParts: string[] = [];
  for (const part of parts) {
    if (!uniqueParts.includes(part)) uniqueParts.push(part);
  }

  const label = uniqueParts.slice(0, 4).join(", ");
  const isCoarse =
    !addressData.road && !addressData.neighborhood && !addressData.village && !addressData.town;

  return (
    <div className="min-w-0">
      <div className="truncate">{label || "Unknown location"}</div>
      {isCoarse && (
        <div className="font-mono text-[10px] text-muted-foreground">
          {coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)}
        </div>
      )}
    </div>
  );
}

function getTrendIcon(trend: "up" | "down" | "stable") {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
    case "down":
      return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
    case "stable":
      return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getSeverityIcon(severity: string | null) {
  switch (severity) {
    case "HIGH":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "WARNING":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    case "NORMAL":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function GroupedView({
  locations,
  selectedLocationKey,
  onSelectLocation,
}: GroupedViewProps) {
  // If no location selected, select the first one with reports
  const effectiveSelectedKey =
    selectedLocationKey && locations.some((l) => l.locationKey === selectedLocationKey)
      ? selectedLocationKey
      : locations[0]?.locationKey;
  const selectedLocation = locations.find((l) => l.locationKey === effectiveSelectedKey);

  if (locations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <MapPin className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No reports found</p>
        <p className="text-sm">Try adjusting your filters or time range</p>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-4">
      {/* Left Sidebar - Location List */}
      <div className="w-80 flex-shrink-0 flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b bg-muted/50">
          <h3 className="font-semibold text-sm">
            📍 Locations ({locations.length})
          </h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {locations.map((location) => (
              <button
                key={location.locationKey}
                onClick={() => onSelectLocation(location.locationKey)}
                className={cn(
                  "w-full text-left p-3 rounded-md transition-all border",
                  effectiveSelectedKey === location.locationKey
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-card border-transparent hover:bg-accent/50"
                )}
              >
                {/* Location Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getSeverityIcon(location.latestReport.severity)}
                    <span className="font-medium text-sm truncate">
                      <LocationNameDisplay coordinates={location.coordinates} />
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                    {location.reportCount}
                  </Badge>
                </div>

                {/* Status Summary */}
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <Badge
                    variant={
                      location.latestReport.severity === "HIGH"
                        ? "destructive"
                        : location.latestReport.severity === "WARNING"
                        ? "default"
                        : "secondary"
                    }
                    className="text-[9px] h-4"
                  >
                    {location.latestReport.severity || "NORMAL"}
                  </Badge>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(location.latestReport.date), { addSuffix: true })}
                  </span>
                  {location.reportCount > 1 && (
                    <span className="flex items-center gap-1 ml-auto">
                      {getTrendIcon(location.trend)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Location Detail */}
      <div className="flex-1 min-w-0">
        {selectedLocation ? (
          <LocationDetail location={selectedLocation} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground border rounded-lg bg-card">
            <MapPin className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a location to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

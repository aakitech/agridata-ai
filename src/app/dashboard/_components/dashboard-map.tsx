"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Badge } from "~/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import {
  createCustomMarkerIcon,
  injectMarkerStyles,
  type SeverityType,
  type RecencyType,
} from "~/lib/map-utils";
import {
  ChevronDown,
  ChevronUp,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  formatWeatherMetric,
  getWeatherStatusUI,
  normalizeReportWeatherUI,
} from "~/lib/weather-ui";

interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  pest: string | null;
  severity: SeverityType;
  count: number | null;
  summaryValue?: string | null;
  date: Date;
  officerName: string;
  /** Stable bucket key for one-marker-per-location */
  locationKey: string;
  location: string;
  recency: RecencyType;
  recentHistory: Array<{
    id: string;
    pest: string | null;
    severity: SeverityType;
    count: number | null;
    summaryValue?: string | null;
    date: Date;
    officerName: string;
  }>;
  weather?: {
    status: "PENDING" | "OK" | "FAILED" | "NEEDS_REVIEW";
    qualityFlag?: "UNKNOWN" | "PLAUSIBLE" | "SUSPECT";
    source?: string | null;
    observedLocalDate?: string;
    fetchedAt?: string | Date | null;
    rainfallMm?: number | string | null;
    relativeHumidityPct?: number | string | null;
    avgTempC?: number | string | null;
    rainDayMm?: number | string | null;
    tempMeanC?: number | string | null;
    tempMinC?: number | string | null;
    tempMaxC?: number | string | null;
    rain7dMm?: number | string | null;
    isMock?: boolean;
  } | null;
}

interface DashboardMapProps {
  points: MapPoint[];
}

/**
 * Get human-readable recency label
 */
const getRecencyLabel = (recency: RecencyType, date: Date): string => {
  const daysAgo = differenceInDays(new Date(), date);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo <= 7) return `${daysAgo} days ago`;
  return format(date, "MMM d, yyyy");
};

/**
 * Get trend indicator: prefer count delta (latest vs previous), fallback to severity rank.
 */
const getTrend = (
  current: MapPoint
): { direction: "up" | "down" | "stable"; label: string } => {
  if (current.recentHistory.length === 0) {
    return { direction: "stable", label: "No prior data" };
  }

  const previous = current.recentHistory[0]!;
  const currCount = current.count ?? null;
  const prevCount = previous.count ?? null;

  // Prefer count-based trend when both counts are numeric
  if (typeof currCount === "number" && typeof prevCount === "number") {
    if (currCount > prevCount) return { direction: "up", label: "Increasing" };
    if (currCount < prevCount)
      return { direction: "down", label: "Decreasing" };
    return { direction: "stable", label: "Stable" };
  }

  // Fallback to severity rank when counts missing/unreliable
  const severityRank: Record<string, number> = {
    HIGH: 3,
    WARNING: 2,
    NORMAL: 1,
  };
  const currentRank = severityRank[current.severity ?? "NORMAL"] ?? 1;
  const previousRank = severityRank[previous.severity ?? "NORMAL"] ?? 1;
  if (currentRank > previousRank)
    return { direction: "up", label: "Increasing" };
  if (currentRank < previousRank)
    return { direction: "down", label: "Decreasing" };
  return { direction: "stable", label: "Stable" };
};

/**
 * History section: previous 3–5 reports from the same location (collapsed by default).
 */
function HistorySection({ history }: { history: MapPoint["recentHistory"] }) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2 border-t border-muted-foreground/15 mt-1">
        No previous reports at this location
      </div>
    );
  }

  const displayHistory = expanded ? history : history.slice(0, 3);
  const hasMore = history.length > 3;

  return (
    <div className="border-t border-muted-foreground/15 pt-1 mt-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <History className="w-3.5 h-3.5 shrink-0" />
        <span>Previous reports ({history.length})</span>
        {hasMore &&
          (expanded ? (
            <ChevronUp className="w-3.5 h-3.5 ml-auto shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 ml-auto shrink-0" />
          ))}
      </button>

       <div
         className={cn(
           "space-y-1 mt-1",
           !expanded && hasMore && "max-h-[90px] overflow-hidden"
         )}
       >
        {displayHistory.map((report) => {
          const initials =
            report.officerName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "—";
          return (
             <div
               key={report.id}
               className="flex items-center justify-between gap-1 text-[10px] py-0"
             >
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    report.severity === "HIGH" && "bg-red-500",
                    report.severity === "WARNING" && "bg-amber-500",
                    (!report.severity || report.severity === "NORMAL") &&
                      "bg-green-500"
                  )}
                />
                <span className="text-muted-foreground shrink-0">
                  {format(new Date(report.date), "MMM d")}
                </span>
                <span
                  className="text-muted-foreground/80 truncate"
                  title={report.officerName}
                >
                  {initials}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-medium">
                  {report.summaryValue ?? report.count ?? "N/A"}
                </span>
                 {report.severity && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[8px] px-1.5 h-3.5 font-bold uppercase tracking-tighter border",
                      report.severity === "HIGH" && "bg-red-500/10 text-red-600 border-red-500/20",
                      report.severity === "WARNING" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                      (!report.severity || report.severity === "NORMAL") && "bg-green-500/10 text-green-600 border-green-500/20"
                    )}
                  >
                    {report.severity[0]}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardMap({ points }: DashboardMapProps) {
  // Zimbabwe center roughly [-19.0154, 29.1549]
  const center: [number, number] = [-19.0154, 29.1549];
  const zoom = 6;

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    injectMarkerStyles();
  }, []);

  if (!isMounted) {
    return (
      <div className="h-full w-full rounded-xl overflow-hidden border shadow-inner bg-muted/5 flex items-center justify-center animate-pulse">
        Loading Map...
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border shadow-inner bg-muted/5">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standard">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {points.map((point) => {
            const icon = createCustomMarkerIcon(point.severity, {
              recency: point.recency,
            });
            const trend = getTrend(point);
            const weather = normalizeReportWeatherUI(point.weather);
            const weatherStatus = getWeatherStatusUI(weather?.status);

            return (
              <Marker
                key={point.locationKey ?? point.id}
                position={[point.lat, point.lon]}
                icon={icon}
              >
                <Popup className="premium-popup">
                  <div className="p-2 space-y-1 min-w-[200px] max-w-[260px]">
                    {/* 1. Pest name + severity (current state) */}
                     <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-sm text-foreground leading-tight">
                          {point.pest || "Unspecified Pest"}
                        </p>
                      {point.severity && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1.5 h-4 uppercase tracking-wider font-bold shrink-0 border",
                            point.severity === "HIGH" && "bg-red-500/10 text-red-600 border-red-500/20",
                            point.severity === "WARNING" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                            point.severity === "NORMAL" && "bg-green-500/10 text-green-600 border-green-500/20"
                          )}
                        >
                          {point.severity}
                        </Badge>
                      )}
                    </div>

                     {/* 2. Primary value + Last reported (current state) */}
                     <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-muted-foreground/15">
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-wide">
                          Primary value
                        </p>
                        <p className="font-semibold text-foreground">
                          {point.summaryValue ?? point.count ?? "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-wide">
                          Last reported
                        </p>
                        <p className="font-semibold text-foreground">
                          {getRecencyLabel(point.recency, new Date(point.date))}
                        </p>
                      </div>
                    </div>

                     {/* 3. Trend: clear arrow + label */}
                     <div className="flex items-center gap-2 py-0.5">
                      {trend.direction === "up" && (
                        <TrendingUp
                          className="w-4 h-4 text-red-500 shrink-0"
                          aria-hidden
                        />
                      )}
                      {trend.direction === "down" && (
                        <TrendingDown
                          className="w-4 h-4 text-green-500 shrink-0"
                          aria-hidden
                        />
                      )}
                      {trend.direction === "stable" && (
                        <Minus
                          className="w-4 h-4 text-muted-foreground shrink-0"
                          aria-hidden
                        />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {trend.label}
                      </span>
                    </div>

                     {/* 4. Field officer */}
                     <div className="pt-0">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {point.officerName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "—"}
                        </div>
                        <p className="text-xs font-medium truncate">
                          {point.officerName}
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Field Officer
                      </p>
                    </div>

                    {/* 5. Weather snapshot (latest report only) */}
                    <div className="border-t border-muted-foreground/15 pt-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Weather
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset",
                            weatherStatus.toneClass
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", weatherStatus.dotClass)} />
                          {weather ? weatherStatus.label : "Unavailable"}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                        <div>
                          Rainfall: {weather && (weather.status === "OK" || weather.status === "NEEDS_REVIEW") ? formatWeatherMetric(weather.rainfallMm, " mm") : "N/A"}
                        </div>
                        <div>
                          Temp (avg): {weather && (weather.status === "OK" || weather.status === "NEEDS_REVIEW") ? formatWeatherMetric(weather.avgTempC, " °C") : "N/A"}
                        </div>
                        <div>
                          RH: {weather && (weather.status === "OK" || weather.status === "NEEDS_REVIEW") ? formatWeatherMetric(weather.relativeHumidityPct, "%") : "N/A"}
                        </div>
                        <div>
                          Date: {weather?.observedLocalDate || "N/A"}
                        </div>
                        {weather?.isMock && <div>Mock Weather</div>}
                      </div>
                    </div>

                    {/* 6. Previous reports (same location bucket) */}
                    <HistorySection history={point.recentHistory} />
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

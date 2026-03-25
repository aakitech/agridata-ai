"use client";

import { MapPin, TrendingUp, TrendingDown, Minus, Clock, Calendar, User, Bug } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { LocationWithReports } from "~/server/modules/analytics/analytics-service";
import {
  formatWeatherMetric,
  getWeatherStatusUI,
  normalizeReportWeatherUI,
} from "~/lib/weather-ui";
import { cn } from "~/lib/utils";

interface LocationDetailProps {
  location: LocationWithReports;
}

function getTrendIcon(trend: "up" | "down" | "stable") {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    case "stable":
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSeverityTooltip(severity: string | null): string {
  switch (severity) {
    case "HIGH":
      return "Reports where observed counts exceed defined pest thresholds.";
    case "WARNING":
      return "Reports approaching threshold levels.";
    case "NORMAL":
    default:
      return "Reports below alert thresholds.";
  }
}

export function LocationDetail({ location }: LocationDetailProps) {
  const latest = location.latestReport;
  const latestWeather = normalizeReportWeatherUI(latest.weather);
  const latestWeatherStatus = getWeatherStatusUI(latestWeather?.status);
  const { data: addressData, isLoading: addressLoading } = api.reports.reverseGeocode.useQuery(
    { lat: location.coordinates.lat, lon: location.coordinates.lon },
    { enabled: true, staleTime: Infinity }
  );

  const parts = addressData
    ? ([
      addressData.road,
        addressData.neighborhood,
        addressData.suburb,
        addressData.village,
        addressData.town,
        addressData.city,
        addressData.county,
        addressData.state,
      ].filter(Boolean) as string[])
    : [];

  const uniqueParts: string[] = [];
  for (const part of parts) {
    if (!uniqueParts.includes(part)) uniqueParts.push(part);
  }

  const locationName =
    uniqueParts.slice(0, 4).join(", ") || "Unknown location";

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {addressLoading ? "Loading location..." : locationName}
            </h2>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">
                {location.coordinates.lat.toFixed(6)}, {location.coordinates.lon.toFixed(6)}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {location.reportCount} reports
          </Badge>
        </div>

        {/* Latest Status Summary */}
        <div className="mt-4 p-3 bg-background rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={
                        latest.severity === "HIGH"
                          ? "destructive"
                          : latest.severity === "WARNING"
                          ? "default"
                          : "secondary"
                      }
                      className="text-sm h-7 px-3"
                    >
                      Current: {latest.severity || "NORMAL"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                    {getSeverityTooltip(latest.severity)}
                  </TooltipContent>
                </Tooltip>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                    latestWeatherStatus.toneClass
                  )}
                  title="Estimated weather from external provider (latest report only)"
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", latestWeatherStatus.dotClass)} />
                  Weather: {latestWeather ? latestWeatherStatus.label : "Unavailable"}
                </span>
                {latestWeather?.isMock && (
                  <Badge variant="outline" className="h-6 text-[10px]">
                    Mock Weather
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Last reported {formatDistanceToNow(new Date(latest.date), { addSuffix: true })}
                </span>
              </div>
            </div>
            {location.trend && (
              <div className="flex items-center gap-1 text-sm">
                {getTrendIcon(location.trend)}
                <span className="text-muted-foreground">
                  {location.trend === "up" ? "Increasing" : location.trend === "down" ? "Decreasing" : "Stable"}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">
              Latest: <span className="font-semibold">{latest.count ?? "N/A"}</span> {latest.pest}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">by {latest.officer}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
            <div className="rounded-md border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Weather Date (Local)</div>
              <div className="text-sm font-medium">{latestWeather?.observedLocalDate || "N/A"}</div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Rainfall</div>
              <div className="text-sm font-medium">
                {latestWeather && (latestWeather.status === "OK" || latestWeather.status === "NEEDS_REVIEW")
                  ? formatWeatherMetric(latestWeather.rainfallMm, " mm")
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Temp (Avg)</div>
              <div className="text-sm font-medium">
                {latestWeather && (latestWeather.status === "OK" || latestWeather.status === "NEEDS_REVIEW")
                  ? formatWeatherMetric(latestWeather.avgTempC, "°C")
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Temp (Min)</div>
              <div className="text-sm font-medium">
                {latestWeather && (latestWeather.status === "OK" || latestWeather.status === "NEEDS_REVIEW")
                  ? formatWeatherMetric(latestWeather.minTempC, "°C")
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Temp (Max)</div>
              <div className="text-sm font-medium">
                {latestWeather && (latestWeather.status === "OK" || latestWeather.status === "NEEDS_REVIEW")
                  ? formatWeatherMetric(latestWeather.maxTempC, "°C")
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-md border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Relative Humidity</div>
              <div className="text-sm font-medium">
                {latestWeather && (latestWeather.status === "OK" || latestWeather.status === "NEEDS_REVIEW")
                  ? formatWeatherMetric(latestWeather.relativeHumidityPct, "%")
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report History */}
      <div className="flex-1 min-h-0">
        <div className="p-3 border-b bg-muted/20">
          <h3 className="font-medium text-sm">📋 Location History</h3>
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-3 space-y-2">
            {location.reports.map((report) => {
              const reportWeather = normalizeReportWeatherUI(report.weather);
              const reportWeatherStatus = getWeatherStatusUI(reportWeather?.status);
              return (
              <Dialog key={report.id}>
                <DialogTrigger asChild>
                  <div className="p-3 rounded-lg border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {report.officer.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{report.officer}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(report.date), "MMM d, yyyy HH:mm")}
                          </div>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={
                              report.severity === "HIGH"
                                ? "destructive"
                                : report.severity === "WARNING"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {report.severity || "NORMAL"}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-xs">
                          {getSeverityTooltip(report.severity)}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <Bug className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{report.count ?? "N/A"}</span>
                      <span>{report.pest || "Unknown"}</span>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Report Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/40 rounded-lg">
                        <div className="text-xs text-muted-foreground uppercase">Pest</div>
                        <div className="text-lg font-bold">{report.pest || "Unknown"}</div>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg">
                        <div className="text-xs text-muted-foreground uppercase">Count</div>
                        <div className="text-lg font-bold font-mono">{report.count ?? "N/A"}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Severity</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={
                              report.severity === "HIGH"
                                ? "destructive"
                                : report.severity === "WARNING"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {report.severity || "NORMAL"}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-xs">
                          {getSeverityTooltip(report.severity)}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Officer</span>
                      <span className="text-sm font-medium flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {report.officer}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Date</span>
                      <span className="text-sm font-medium flex items-center gap-1">
                        {format(new Date(report.date), "MMM d, yyyy HH:mm")}
                        <Calendar className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground uppercase">Weather</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ring-1 ring-inset",
                            reportWeatherStatus.toneClass
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", reportWeatherStatus.dotClass)} />
                          {reportWeather ? reportWeatherStatus.label : "Unavailable"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Weather Date (Local)</div>
                          <div className="font-medium">{reportWeather?.observedLocalDate || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Source</div>
                          <div className="font-medium truncate">{reportWeather?.source || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Rainfall</div>
                          <div className="font-medium">
                            {reportWeather && (reportWeather.status === "OK" || reportWeather.status === "NEEDS_REVIEW")
                              ? formatWeatherMetric(reportWeather.rainfallMm, " mm")
                              : "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Temp (Avg)</div>
                          <div className="font-medium">
                            {reportWeather && (reportWeather.status === "OK" || reportWeather.status === "NEEDS_REVIEW")
                              ? formatWeatherMetric(reportWeather.avgTempC, "°C")
                              : "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Temp (Min)</div>
                          <div className="font-medium">
                            {reportWeather && (reportWeather.status === "OK" || reportWeather.status === "NEEDS_REVIEW")
                              ? formatWeatherMetric(reportWeather.minTempC, "°C")
                              : "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Temp (Max)</div>
                          <div className="font-medium">
                            {reportWeather && (reportWeather.status === "OK" || reportWeather.status === "NEEDS_REVIEW")
                              ? formatWeatherMetric(reportWeather.maxTempC, "°C")
                              : "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Relative Humidity</div>
                          <div className="font-medium">
                            {reportWeather && (reportWeather.status === "OK" || reportWeather.status === "NEEDS_REVIEW")
                              ? formatWeatherMetric(reportWeather.relativeHumidityPct, "%")
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                      {reportWeather?.fetchedAt && (
                        <div className="text-[10px] text-muted-foreground">
                          Fetched: {new Date(reportWeather.fetchedAt).toLocaleString()}
                        </div>
                      )}
                      {reportWeather?.isMock && (
                        <div className="text-[10px] text-muted-foreground">Mock Weather</div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

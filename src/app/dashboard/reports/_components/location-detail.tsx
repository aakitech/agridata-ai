"use client";

import { MapPin, TrendingUp, TrendingDown, Minus, Clock, Calendar, User, Bug } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
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

interface LocationDetailProps {
  location: LocationWithReports;
}

function ReportLocationDisplay({ location }: { location: string | null }) {
  if (!location) return null;

  const coordinates = location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  const lat = coordinates ? parseFloat(coordinates[2]!) : null;
  const lon = coordinates ? parseFloat(coordinates[1]!) : null;

  const { data: addressData, isLoading } = api.reports.reverseGeocode.useQuery(
    { lat: lat!, lon: lon! },
    { enabled: !!lat && !!lon, staleTime: Infinity }
  );

  if (isLoading) return <span className="text-sm">Loading...</span>;
  if (!addressData) {
    return (
      <span className="text-sm font-mono">
        {lat?.toFixed(6)}, {lon?.toFixed(6)}
      </span>
    );
  }

  const parts = [addressData.suburb, addressData.city, addressData.state].filter(Boolean);
  return <span className="text-sm">{parts.join(", ") || "Unknown location"}</span>;
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

export function LocationDetail({ location }: LocationDetailProps) {
  const latest = location.latestReport;

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {location.displayName || "Unknown Location"}
            </h2>
            <div className="mt-1 text-sm text-muted-foreground">
              <ReportLocationDisplay location={location.coordinates ? `POINT(${location.coordinates.lon} ${location.coordinates.lat})` : null} />
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
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Last reported {formatDistanceToNow(new Date(latest.date), { addSuffix: true })}
              </span>
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
        </div>
      </div>

      {/* Report History */}
      <div className="flex-1 min-h-0">
        <div className="p-3 border-b bg-muted/20">
          <h3 className="font-medium text-sm">📋 Location History</h3>
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-3 space-y-2">
            {location.reports.map((report) => (
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
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

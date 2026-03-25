"use client";

import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Phone, Image as ImageIcon, CloudRain, Thermometer, Droplets } from "lucide-react";
import {
  formatWeatherMetric,
  getWeatherStatusUI,
  normalizeReportWeatherUI,
} from "~/lib/weather-ui";

type Report = {
  id: string;
  mediaUrl: string | null;
  createdAt: Date;
  category: "PEST" | "DISEASE" | "WEATHER" | null;
  organization?: {
    name: string;
  };
  user?: {
    phoneNumber: string | null;
    // languagePref removed as it's not in app_users
  };
  media?: Array<{
    id: string;
    mediaUrl: string;
    contentType: string | null;
  }>;
  weather?: {
    status: "PENDING" | "OK" | "FAILED" | "NEEDS_REVIEW";
    source?: string | null;
    observedLocalDate?: string;
    fetchedAt?: Date | string | null;
    rainfallMm?: string | number | null;
    relativeHumidityPct?: string | number | null;
    avgTempC?: string | number | null;
    rainDayMm?: string | number | null;
    tempMeanC?: string | number | null;
    isProvisional?: boolean;
    qualityFlag?: "UNKNOWN" | "PLAUSIBLE" | "SUSPECT";
    isMock?: boolean;
  } | null;
};

interface ReportsListProps {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ReportsList({ reports, selectedId, onSelect }: ReportsListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {reports.map((report) => {
          const weather = normalizeReportWeatherUI(report.weather);
          const weatherStatus = getWeatherStatusUI(weather?.status);
          // Get thumbnail (first media image or fallback to mediaUrl)
          const thumbnailUrl = report.media && report.media.length > 0
            ? report.media[0]!.mediaUrl
            : report.mediaUrl;

          return (
            <button
              key={report.id}
              onClick={() => onSelect(report.id)}
              className={cn(
                "w-full p-4 text-left transition-colors hover:bg-muted/50",
                selectedId === report.id && "bg-muted border-l-4 border-primary pl-3"
              )}
            >
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted border">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Report"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                  </span>
                  {report.category && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                      {report.category}
                    </Badge>
                  )}
                  {report.organization && (
                     <Badge variant="outline" className="text-[10px] px-1.5 h-5 truncate max-w-[80px]">
                        {report.organization.name}
                     </Badge>
                  )}
                </div>
                
                <p className="text-sm font-medium leading-none truncate">
                  Report #{report.id.slice(0, 8)}
                </p>
                
                {report.user && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{report.user.phoneNumber}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                      weatherStatus.toneClass
                    )}
                    title="Estimated weather from external provider (when available)"
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", weatherStatus.dotClass)} />
                    {weatherStatus.label}
                  </span>
                  {weather?.isMock && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px]">
                      Mock Weather
                    </Badge>
                  )}
                  {weather?.isProvisional && (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-300 text-amber-700">
                      Provisional
                    </Badge>
                  )}
                  {weather?.status === "OK" && (
                    <>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CloudRain className="h-2.5 w-2.5" />
                        Rainfall: {formatWeatherMetric(weather.rainfallMm, " mm")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Thermometer className="h-2.5 w-2.5" />
                        Temp (Avg): {formatWeatherMetric(weather.avgTempC, "°C")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Droplets className="h-2.5 w-2.5" />
                        RH: {formatWeatherMetric(weather.relativeHumidityPct, "%")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

"use client";

import { useState } from "react";
import { MapPin, Calendar, User, Bug, ChevronLeft, ChevronRight, CircleHelp } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { format } from "date-fns";
import { api } from "~/trpc/react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { ReportWithDetails } from "~/server/modules/analytics/analytics-service";
import { parseLocation } from "~/lib/geo";

interface ListViewProps {
  reports: ReportWithDetails[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | undefined;
  onPageChange?: (page: number) => void;
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

function ReportLocationDisplay({ location }: { location: string | null }) {
  if (!location) return <span className="text-muted-foreground">-</span>;

  const coordinates = parseLocation(location);
  const lat = coordinates?.lat ?? null;
  const lon = coordinates?.lon ?? null;

  const { data: addressData, isLoading } = api.reports.reverseGeocode.useQuery(
    { lat: lat!, lon: lon! },
    { enabled: !!lat && !!lon, staleTime: Infinity }
  );

  if (isLoading) return <span className="text-sm">...</span>;
  if (!addressData) {
    return (
      <span className="text-xs font-mono text-muted-foreground">
        {lat?.toFixed(4)}, {lon?.toFixed(4)}
      </span>
    );
  }

  return (
    <span className="text-sm truncate max-w-[200px]" title={addressData.suburb || addressData.city}>
      {addressData.suburb || addressData.city || "Unknown"}
    </span>
  );
}

export function ListView({ reports, pagination, onPageChange }: ListViewProps) {
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);

  if (reports.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground border rounded-lg bg-card">
        <MapPin className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No reports found</p>
        <p className="text-sm">Try adjusting your filters or time range</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card">
      <div className="flex-1 overflow-auto">
        <div className="sm:hidden space-y-2 p-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-lg border bg-background p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(report.createdAt), "MMM d, yyyy HH:mm")}
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
              <div className="mt-2 flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {report.user?.fullName?.slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {report.user?.fullName || report.user?.phoneNumber || "Unknown"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <span>{report.label || "Unknown"}</span>
                </div>
                <span className="font-mono font-semibold">{report.observedCount ?? "N/A"}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <ReportLocationDisplay location={report.location} />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Pest</TableHead>
                <TableHead>
                  <div className="inline-flex items-center gap-1">
                    <span>Severity</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                          aria-label="Severity definition"
                        >
                          <CircleHelp className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs">
                        High: reports where observed counts exceed defined pest thresholds. Warning: reports approaching threshold levels. Normal: reports below alert thresholds.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow
                  key={report.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => setSelectedReport(report)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(report.createdAt), "MMM d, yyyy HH:mm")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {report.user?.fullName?.slice(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{report.user?.fullName || report.user?.phoneNumber || "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold">{report.observedCount ?? "N/A"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Bug className="h-4 w-4 text-muted-foreground" />
                      <span>{report.label || "Unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <ReportLocationDisplay location={report.location} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} reports
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Report Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase">Pest</div>
                  <div className="text-lg font-bold">{selectedReport.label || "Unknown"}</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase">Count</div>
                  <div className="text-lg font-bold font-mono">{selectedReport.observedCount ?? "N/A"}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Severity</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={
                        selectedReport.severity === "HIGH"
                          ? "destructive"
                          : selectedReport.severity === "WARNING"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {selectedReport.severity || "NORMAL"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                    {getSeverityTooltip(selectedReport.severity)}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Officer</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {selectedReport.user?.fullName || selectedReport.user?.phoneNumber || "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  {format(new Date(selectedReport.createdAt), "MMM d, yyyy HH:mm")}
                  <Calendar className="h-4 w-4" />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Location</span>
                <ReportLocationDisplay location={selectedReport.location} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

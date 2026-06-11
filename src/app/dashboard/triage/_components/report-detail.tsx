"use client";

import { useState, useEffect, useRef } from "react";
import { Share, Check, X, MapPin, AlertTriangle, Info } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { parseLocation } from "~/lib/geo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { canHardTriage } from "~/lib/permissions";
import {
  formatIsoLocalDate,
  formatWeatherMetric,
  getWeatherStatusUI,
  normalizeReportWeatherUI,
} from "~/lib/weather-ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { EnhancementForm } from "./enhancement-form";
import { EnhancementList } from "./enhancement-list";

// Dynamically import the map to avoid SSR issues
const ReportMap = dynamic(
  () => import("./report-map").then((mod) => mod.ReportMap),
  { ssr: false, loading: () => <div className="h-64 bg-muted rounded-lg animate-pulse" /> }
);

type Report = {
  id: string;
  category: "PEST" | "DISEASE" | "WEATHER" | null;
  label?: string | null;
  pestKey?: string | null;
  observationMethod?: string | null;
  observedCount?: number | null;
  alertTriggered?: boolean | null;
  dataPayload?: unknown;
  mediaUrl: string | null;
  location: string | null;
  description: string | null;
  createdAt: Date;
  severity?: "NORMAL" | "WARNING" | "HIGH" | null;
  severitySource?: "ORG_CONFIG" | "DEFAULT_FALLBACK" | "SELF_REPORT" | null;
  organization?: {
    name: string;
  };
  user?: {
    fullName: string | null;
    phoneNumber: string | null;
  };
  media?: Array<{
    id: string;
    mediaUrl: string;
    contentType: string | null;
  }>;
  weather?: {
    status: "PENDING" | "OK" | "FAILED" | "NEEDS_REVIEW";
    source: string | null;
    fetchedAt: Date | null;
    observedLocalDate: string;
    observedAt: Date;
    rainDayMm: string | null;
    rain7dMm: string | null;
    relativeHumidityPct?: string | null;
    rainfallMm?: string | null;
    minTempC?: string | null;
    maxTempC?: string | null;
    avgTempC?: string | null;
    tempMinC: string | null;
    tempMaxC: string | null;
    tempMeanC: string | null;
    isProvisional?: boolean;
    qualityFlag: "UNKNOWN" | "PLAUSIBLE" | "SUSPECT";
  } | null;
};

interface ReportDetailProps {
  report: Report;
  onComplete: () => void;
  userRole: "super_admin" | "org_admin" | "officer";
}

export function ReportDetail({ report, onComplete, userRole }: ReportDetailProps) {
  const [diagnosis, setDiagnosis] = useState("");
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | undefined>(undefined);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();
  
  // Check if user can perform hard triage actions
  const canTriage = canHardTriage(userRole);
  
  const verifyMutation = api.reports.verify.useMutation({
    onSuccess: () => {
      utils.reports.getAll.invalidate();
      toast.success("Report verified successfully");
      onComplete();
    },
    onError: (err) => {
      toast.error(`Verification failed: ${err.message}`);
    },
  });

  const rejectMutation = api.reports.reject.useMutation({
    onSuccess: () => {
      utils.reports.getAll.invalidate();
      toast.success("Report rejected");
      onComplete();
    },
    onError: (err) => {
      toast.error(`Rejection failed: ${err.message}`);
    },
  });


  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const diagnosisRef = useRef<HTMLInputElement>(null);

  const handleVerify = () => {
    if (!diagnosis) {
      toast.error("Please enter a diagnosis");
      diagnosisRef.current?.focus();
      return;
    }
    if (!riskLevel) {
      toast.error("Please select a risk level");
      return;
    }
    verifyMutation.mutate({
      id: report.id,
      diagnosis,
      riskLevel,
    });
  };

  const handleReject = () => {
    if (!rejectionReason) {
      toast.error("Please select a rejection reason");
      return;
    }
    rejectMutation.mutate({
      id: report.id,
      rejectionReason,
    });
    setIsRejectOpen(false);
  };


  // Parse location
  const coordinates = parseLocation(report.location ?? null);
  const lat = coordinates?.lat ?? null;
  const lon = coordinates?.lon ?? null;

  // Server-side reverse geocoding via tRPC
  const { data: addressData, isLoading: isGeocoding } = api.reports.reverseGeocode.useQuery(
    { lat: lat!, lon: lon! },
    { enabled: !!lat && !!lon, staleTime: Infinity }
  );

  // Get all images (from media table or fallback to mediaUrl)
  const images = report.media && report.media.length > 0 
    ? report.media.map(m => m.mediaUrl)
    : report.mediaUrl 
    ? [report.mediaUrl] 
    : [];

  const weather = normalizeReportWeatherUI(report.weather);
  const weatherStatus = getWeatherStatusUI(weather?.status);
  const reportLocalDate = formatIsoLocalDate(report.createdAt);
  const reportPayload =
    report.dataPayload && typeof report.dataPayload === "object"
      ? (report.dataPayload as Record<string, unknown>)
      : null;
  const reportMeta =
    reportPayload?.meta && typeof reportPayload.meta === "object"
      ? (reportPayload.meta as Record<string, unknown>)
      : null;
  const reportRaw =
    reportPayload?.raw && typeof reportPayload.raw === "object"
      ? (reportPayload.raw as Record<string, unknown>)
      : null;
  const isDiseaseReport = report.category === "DISEASE";
  const pestLabel =
    isDiseaseReport
      ? report.label ||
        (typeof reportMeta?.reportTypeLabel === "string" ? reportMeta.reportTypeLabel : null) ||
        "Disease/Symptom"
      : report.label ||
        report.pestKey ||
        (typeof reportMeta?.pestLabel === "string" ? reportMeta.pestLabel : null) ||
        "Unknown";
  const primaryValue =
    isDiseaseReport
      ? reportRaw?.visible_symptoms ?? "Not recorded"
      : report.observedCount ??
        (reportRaw
          ? Object.values(reportRaw).find(
          (value) =>
            value !== null &&
            value !== undefined &&
            value !== "" &&
            (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        )
      : null);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Report Details</h2>
            <div className="flex flex-wrap items-center gap-2">
                {report.organization && (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {report.organization.name}
                    </span>
                )}
                <span className="text-xs sm:text-sm text-muted-foreground">
                    by {report.user?.fullName || report.user?.phoneNumber || "Unknown User"}
                </span>
            </div>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground">ID: {report.id}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Observation Summary</CardTitle>
          <CardDescription>Structured metadata captured from the reporting flow</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">
              {isDiseaseReport ? "Report Type" : "Pest"}
            </Label>
            <div className="font-semibold">{pestLabel}</div>
          </div>
          <div className="rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">Observation Method</Label>
            <div className="font-semibold">{report.observationMethod || "Not recorded"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">
              {isDiseaseReport ? "Primary Observation" : "Primary Value"}
            </Label>
            <div className="font-semibold">{primaryValue != null ? String(primaryValue) : "N/A"}</div>
          </div>
          {isDiseaseReport ? (
            <>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Review Routing</Label>
                <div className="font-semibold">Sent to officer review queue</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Initial Priority</Label>
                <div className="font-semibold">
                  {report.severity === "HIGH"
                    ? "High"
                    : report.severity === "WARNING"
                      ? "Warning"
                      : "Normal"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Priority Source</Label>
                <div className="font-semibold">
                  {report.severitySource === "SELF_REPORT"
                    ? "Farmer's estimate - not yet verified"
                    : "Not recorded"}
                </div>
              </div>
              <div className="rounded-lg border p-3 sm:col-span-3">
                <Label className="text-xs text-muted-foreground">Escalation</Label>
                <div className="font-semibold">
                  {report.alertTriggered
                    ? "Urgent escalation triggered"
                    : "Standard officer review"}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border p-3 sm:col-span-3">
              <Label className="text-xs text-muted-foreground">Alert Outcome</Label>
              <div className="font-semibold">
                {report.alertTriggered ? "Alert triggered" : "No alert triggered"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isDiseaseReport && reportRaw && (
        <Card>
          <CardHeader>
            <CardTitle>Disease/Symptom Context</CardTitle>
            <CardDescription>Structured details captured from the WhatsApp disease intake</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">Crop</Label>
              <div className="font-semibold">{String(reportRaw.crop ?? "Tobacco")}</div>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">Affected Part</Label>
              <div className="font-semibold">{String(reportRaw.affected_part ?? "Not recorded")}</div>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">Symptoms</Label>
              <div className="font-semibold">{String(reportRaw.visible_symptoms ?? "Not recorded")}</div>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">Spread</Label>
              <div className="font-semibold">{String(reportRaw.spread ?? "Not recorded")}</div>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">First Noticed</Label>
              <div className="font-semibold">{String(reportRaw.first_noticed ?? "Not recorded")}</div>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-xs text-muted-foreground">Recent Treatment</Label>
              <div className="font-semibold">{String(reportRaw.recent_treatment ?? "Not recorded")}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>Review the submitted evidence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Images */}
          {images.length > 0 && (
            <div className={images.length === 1 ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
              {images.map((imageUrl, index) => (
                <div key={index} className="rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={imageUrl}
                    alt={`Crop damage ${index + 1}`}
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              ))}
            </div>
          )}


          {/* Description */}
          {report.description && (
            <div className="space-y-2">
              <Label>Farmer Description</Label>
              <div className="p-4 rounded-lg bg-muted text-sm">
                {report.description}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Context Section */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent>
          {lat && lon ? (
            <div className="space-y-4">
              {isGeocoding ? (
                <div className="h-20 bg-muted animate-pulse rounded-lg" />
              ) : addressData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addressData.country && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Country</Label>
                      <div className="font-medium">{addressData.country}</div>
                    </div>
                  )}
                  {addressData.state && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Province/State</Label>
                      <div className="font-medium">{addressData.state}</div>
                    </div>
                  )}
                  {(addressData.city || addressData.suburb) && (
                    <div className="space-y-1 col-span-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Area</Label>
                      <div className="font-medium">
                        {[addressData.city, addressData.suburb].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{lat.toFixed(6)}, {lon.toFixed(6)}</span>
              </div>
              <div className="h-[300px] rounded-lg overflow-hidden border">
                <ReportMap latitude={lat} longitude={lon} reportId={report.id} severity={report.severity} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
              No location data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weather Section */}
      <Card>
        <CardHeader>
          <CardTitle>Weather Context</CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1">
              Estimated daily weather conditions for this report location
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-muted-foreground hover:text-foreground"
                    aria-label="Weather estimate help"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs">
                  Estimated from an external weather provider for the report location and local date.
                </TooltipContent>
              </Tooltip>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${weatherStatus.toneClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${weatherStatus.dotClass}`} />
              {weather ? weatherStatus.label : "Unavailable"}
            </span>
            {weather?.isMock && (
              <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium">
                Mock Weather
              </span>
            )}
            {weather?.isProvisional && (
              <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                Provisional
              </span>
            )}
            {weather?.source && (
              <span className="text-xs text-muted-foreground">
                Source: {weather.source}
              </span>
            )}
          </div>

          {weather && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm">
                <Label className="text-xs text-muted-foreground">Report Date vs Weather Date (Local)</Label>
                <div className="font-medium">
                  Report: {reportLocalDate} • Weather: {weather.observedLocalDate || "N/A"}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Weather Date (Local)</Label>
                <div className="font-medium">{weather.observedLocalDate}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Fetched At</Label>
                <div className="font-medium">
                  {weather.fetchedAt ? new Date(weather.fetchedAt).toLocaleString() : "N/A"}
                </div>
              </div>
            </div>
            </div>
          )}

          {weather?.status === "OK" || weather?.status === "NEEDS_REVIEW" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Rainfall</Label>
                <div className="text-base font-semibold">{formatWeatherMetric(weather.rainfallMm, " mm")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Rain (7d)</Label>
                <div className="text-base font-semibold">{formatWeatherMetric(weather.rain7dMm, " mm")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Temp (Avg)</Label>
                <div className="text-base font-semibold">{formatWeatherMetric(weather.avgTempC, "°C")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Temp (Min)</Label>
                <div className="text-base font-semibold">{formatWeatherMetric(weather.minTempC, "°C")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Temp (Max)</Label>
                <div className="text-base font-semibold">{formatWeatherMetric(weather.maxTempC, "°C")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Relative Humidity</Label>
                <div className="text-base font-semibold">{formatWeatherMetric(weather.relativeHumidityPct, "%")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">Quality</Label>
                <div className="text-base font-semibold">{weather.qualityFlag}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Weather data is not available yet for this report.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annotations Section - Visible to all roles */}
      <Card>
        <CardHeader>
          <CardTitle>Annotations</CardTitle>
          <CardDescription>Add context, quality flags, or internal notes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <EnhancementForm reportId={report.id} />
          <Separator />
          <EnhancementList reportId={report.id} />
        </CardContent>
      </Card>

      {/* Action Form - Only for super_admin */}
      {canTriage ? (
        <Card className="border-2 border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              AI Training & Ground Truth
            </CardTitle>
            <CardDescription className="text-primary/80">
              Expert verification for AI model training. This "Ground Truth" data is used to calibrate detection algorithms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            
            {/* Verification Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="diagnosis">Final Diagnosis <span className="text-destructive">*</span></Label>
                <Input
                  ref={diagnosisRef}
                  id="diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g., African Armyworm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="riskLevel">Severity Risk Level <span className="text-destructive">*</span></Label>
                <Select
                  value={riskLevel}
                  onValueChange={(val) => setRiskLevel(val as "LOW" | "MEDIUM" | "HIGH")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low - Common/Manageable</SelectItem>
                    <SelectItem value="MEDIUM">Medium - Significant Damage</SelectItem>
                    <SelectItem value="HIGH">High - Quarantine/Rapid Spread</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  High = Quarantine pests or swarming behavior
                </div>
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <X className="mr-2 h-4 w-4" />
                    Discard Report
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Discard Report</DialogTitle>
                    <DialogDescription>
                      This report will be marked as invalid and excluded from AI training sets.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="reason">Rejection Reason <span className="text-destructive">*</span></Label>
                      <Select
                        value={rejectionReason}
                        onValueChange={setRejectionReason}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Blurry">Blurry Image</SelectItem>
                          <SelectItem value="Not a Crop">Not a Crop</SelectItem>
                          <SelectItem value="Duplicate">Duplicate Report</SelectItem>
                          <SelectItem value="Insufficient Info">Insufficient Information</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                     <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                     <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
                       {rejectMutation.isPending ? "Discarding..." : "Confirm Discard"}
                     </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg" 
                onClick={handleVerify}
                disabled={verifyMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                {verifyMutation.isPending ? "Saving..." : "Approve as Ground Truth"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Info banner for org_admin users */
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Final verification of reports is handled by expert reviewers to ensure consistent model training and data quality.
            You can add annotations above to provide context and flag issues.
          </AlertDescription>
        </Alert>
      )}

    </div>
  );
}

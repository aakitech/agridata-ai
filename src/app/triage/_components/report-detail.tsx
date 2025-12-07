"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Check, X, MapPin, AlertTriangle } from "lucide-react";

// Dynamically import the map to avoid SSR issues
const ReportMap = dynamic(
  () => import("./report-map").then((mod) => mod.ReportMap),
  { ssr: false, loading: () => <div className="h-64 bg-muted rounded-lg animate-pulse" /> }
);

type Report = {
  id: string;
  mediaUrl: string | null;

  location: string | null;
  description: string | null;
  createdAt: Date;
  media?: Array<{
    id: string;
    mediaUrl: string;
    contentType: string | null;
  }>;
};

interface ReportDetailProps {
  report: Report;
  onComplete: () => void;
}

export function ReportDetail({ report, onComplete }: ReportDetailProps) {
  const [action, setAction] = useState<"verify" | "reject">("verify");
  const [diagnosis, setDiagnosis] = useState("");
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();
  
  const verifyMutation = api.reports.verify.useMutation({
    onSuccess: () => {
      utils.reports.getAll.invalidate();
      onComplete();
    },
  });

  const rejectMutation = api.reports.reject.useMutation({
    onSuccess: () => {
      utils.reports.getAll.invalidate();
      onComplete();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (action === "verify") {
      if (!diagnosis) {
        alert("Please enter a diagnosis");
        return;
      }
      verifyMutation.mutate({
        id: report.id,
        diagnosis,
        riskLevel,
      });
    } else {
      if (!rejectionReason) {
        alert("Please select a rejection reason");
        return;
      }
      rejectMutation.mutate({
        id: report.id,
        rejectionReason,
      });
    }
  };



  // Parse location
  const coordinates = report.location?.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  const lat = coordinates ? parseFloat(coordinates[2]!) : null;
  const lon = coordinates ? parseFloat(coordinates[1]!) : null;

  // Get all images (from media table or fallback to mediaUrl)
  const images = report.media && report.media.length > 0 
    ? report.media.map(m => m.mediaUrl)
    : report.mediaUrl 
    ? [report.mediaUrl] 
    : [];

  // Location state
  const [locationDetails, setLocationDetails] = useState<{
    country?: string;
    state?: string;
    suburb?: string;
    city?: string;
  } | null>(null);

  useEffect(() => {
    if (lat && lon) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            setLocationDetails({
              country: data.address.country,
              state: data.address.state || data.address.province,
              suburb: data.address.suburb || data.address.neighborhood,
              city: data.address.city || data.address.town || data.address.village,
            });
          }
        })
        .catch(err => console.error("Geocoding error:", err));
    } else {
      setLocationDetails(null);
    }
  }, [lat, lon]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Report Details</h2>
        <div className="text-sm text-muted-foreground">ID: {report.id}</div>
      </div>

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>Review the submitted evidence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Images */}
          {images.length > 0 && (
            <div className={images.length === 1 ? "" : "grid grid-cols-2 gap-4"}>
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
              {locationDetails && (
                <div className="grid grid-cols-2 gap-4">
                  {locationDetails.country && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Country</Label>
                      <div className="font-medium">{locationDetails.country}</div>
                    </div>
                  )}
                  {locationDetails.state && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Province/State</Label>
                      <div className="font-medium">{locationDetails.state}</div>
                    </div>
                  )}
                  {(locationDetails.city || locationDetails.suburb) && (
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-muted-foreground">Area</Label>
                      <div className="font-medium">
                        {[locationDetails.city, locationDetails.suburb].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{lat.toFixed(6)}, {lon.toFixed(6)}</span>
              </div>
              <div className="h-[300px] rounded-lg overflow-hidden border">
                <ReportMap latitude={lat} longitude={lon} reportId={report.id} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
              No location data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Form */}
      <Card>
        <CardHeader>
          <CardTitle>Decision</CardTitle>
          <CardDescription>Verify or reject this report</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Action Toggle */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant={action === "verify" ? "default" : "outline"}
                className={action === "verify" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setAction("verify")}
              >
                <Check className="mr-2 h-4 w-4" />
                Verify
              </Button>
              <Button
                type="button"
                variant={action === "reject" ? "destructive" : "outline"}
                onClick={() => setAction("reject")}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>

            <Separator />

            {/* Verify Fields */}
            {action === "verify" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnosis <span className="text-destructive">*</span></Label>
                  <Input
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g., Fall Armyworm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="riskLevel">Risk Level <span className="text-destructive">*</span></Label>
                  <Select
                    value={riskLevel}
                    onValueChange={(val) => setRiskLevel(val as "LOW" | "MEDIUM" | "HIGH")}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
            )}

            {/* Reject Fields */}
            {action === "reject" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
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
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={verifyMutation.isPending || rejectMutation.isPending}
              variant={action === "verify" ? "default" : "destructive"}
            >
              {verifyMutation.isPending || rejectMutation.isPending
                ? "Processing..."
                : `Confirm ${action === "verify" ? "Verification" : "Rejection"}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

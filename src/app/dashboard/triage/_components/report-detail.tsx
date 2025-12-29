"use client";

import { useState, useEffect, useRef } from "react";
import { Share, Check, X, MapPin, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { api } from "~/trpc/react";
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

// ... inside ReportDetail component






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
};

interface ReportDetailProps {
  report: Report;
  onComplete: () => void;
}

export function ReportDetail({ report, onComplete }: ReportDetailProps) {
  const [diagnosis, setDiagnosis] = useState("");
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH" | undefined>(undefined);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();
  
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
        <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Report Details</h2>
            <div className="flex items-center gap-2">
                {report.organization && (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {report.organization.name}
                    </span>
                )}
                <span className="text-sm text-muted-foreground">
                    by {report.user?.fullName || report.user?.phoneNumber || "Unknown User"}
                </span>
            </div>
        </div>
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
        <CardContent className="space-y-6">
          
          {/* Verification Fields (Always Visible) */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis <span className="text-destructive">*</span></Label>
              <Input
                ref={diagnosisRef}
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
          <div className="flex gap-4">
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <X className="mr-2 h-4 w-4" />
                  Reject Report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject Report</DialogTitle>
                  <DialogDescription>
                    Please provide a reason for rejecting this report. This feedback helps improve the system.
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
                     {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                   </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
              onClick={handleVerify}
              disabled={verifyMutation.isPending}
            >
              <Check className="mr-2 h-4 w-4" />
              {verifyMutation.isPending ? "Verifying..." : "Verify Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

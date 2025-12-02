"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";

// Dynamically import the map to avoid SSR issues
const ReportMap = dynamic(
  () => import("./report-map").then((mod) => mod.ReportMap),
  { ssr: false, loading: () => <div className="h-64 bg-gray-200 rounded-lg animate-pulse" /> }
);

type Report = {
  id: string;
  mediaUrl: string | null;
  audioUrl: string | null;
  location: string | null;
  description: string | null;
  createdAt: Date;
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
      utils.reports.getPending.invalidate();
      onComplete();
    },
  });

  const rejectMutation = api.reports.reject.useMutation({
    onSuccess: () => {
      utils.reports.getPending.invalidate();
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Report Details</h2>

      {/* Evidence Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Evidence</h3>
        
        {/* Image */}
        {report.mediaUrl && (
          <div className="mb-4">
            <img
              src={report.mediaUrl}
              alt="Crop damage"
              className="w-full max-h-96 object-contain rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Audio */}
        {report.audioUrl && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice Note
            </label>
            <audio controls src={report.audioUrl} className="w-full" />
          </div>
        )}

        {/* Description */}
        {report.description && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Farmer Description
            </label>
            <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">
              {report.description}
            </p>
          </div>
        )}
      </div>

      {/* Context Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Location</h3>
        {lat && lon ? (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Coordinates: {lat.toFixed(6)}, {lon.toFixed(6)}
            </p>
            <div className="h-64 rounded-lg overflow-hidden">
              <ReportMap latitude={lat} longitude={lon} reportId={report.id} />
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No location data</p>
        )}
      </div>

      {/* Action Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Decision</h3>

        {/* Action Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setAction("verify")}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              action === "verify"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            ✓ Verify
          </button>
          <button
            type="button"
            onClick={() => setAction("reject")}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              action === "reject"
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            ✗ Reject
          </button>
        </div>

        {/* Verify Fields */}
        {action === "verify" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Diagnosis <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g., Fall Armyworm"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level <span className="text-red-500">*</span>
              </label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="LOW">Low - Common/Manageable</option>
                <option value="MEDIUM">Medium - Significant Damage</option>
                <option value="HIGH">High - Quarantine/Rapid Spread</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                High = Quarantine pests or swarming behavior
              </p>
            </div>
          </div>
        )}

        {/* Reject Fields */}
        {action === "reject" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            >
              <option value="">Select a reason...</option>
              <option value="Blurry">Blurry Image</option>
              <option value="Not a Crop">Not a Crop</option>
              <option value="Duplicate">Duplicate Report</option>
              <option value="Insufficient Info">Insufficient Information</option>
            </select>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={verifyMutation.isPending || rejectMutation.isPending}
          className={`w-full mt-6 py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            action === "verify"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {verifyMutation.isPending || rejectMutation.isPending
            ? "Processing..."
            : `Confirm ${action === "verify" ? "Verification" : "Rejection"}`}
        </button>
      </form>
    </div>
  );
}

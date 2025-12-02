"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ReportsList } from "./reports-list";
import { ReportDetail } from "./report-detail";

export function TriageDashboard() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  const { data: reports, isLoading } = api.reports.getPending.useQuery();
  const selectedReport = reports?.find((r) => r.id === selectedReportId);

  // Auto-select first report if none selected
  if (!selectedReportId && reports && reports.length > 0) {
    setSelectedReportId(reports[0]!.id);
  }

  return (
    <div className="flex h-screen">
      {/* Left Sidebar - Reports List */}
      <div className="w-[30%] border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Triage Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {reports?.length || 0} pending reports
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : reports && reports.length > 0 ? (
          <ReportsList
            reports={reports}
            selectedId={selectedReportId}
            onSelect={setSelectedReportId}
          />
        ) : (
          <div className="p-4 text-center text-gray-500">
            No pending reports
          </div>
        )}
      </div>

      {/* Right Panel - Report Detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedReport ? (
          <ReportDetail
            report={selectedReport}
            onComplete={() => {
              // Auto-select next report
              const currentIndex = reports?.findIndex((r) => r.id === selectedReportId);
              if (currentIndex !== undefined && reports && currentIndex < reports.length - 1) {
                setSelectedReportId(reports[currentIndex + 1]!.id);
              } else {
                setSelectedReportId(null);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a report to begin triage
          </div>
        )}
      </div>
    </div>
  );
}

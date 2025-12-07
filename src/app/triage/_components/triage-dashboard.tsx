"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ReportsList } from "./reports-list";
import { ReportDetail } from "./report-detail";
import { Loader2, Inbox } from "lucide-react";

export function TriageDashboard() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  const { data: reports, isLoading } = api.reports.getPending.useQuery();
  const selectedReport = reports?.find((r) => r.id === selectedReportId);

  // Auto-select first report if none selected
  if (!selectedReportId && reports && reports.length > 0) {
    setSelectedReportId(reports[0]!.id);
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left Sidebar - Reports List */}
      <div className="w-[350px] border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b bg-background">
          <h1 className="text-xl font-semibold tracking-tight">Triage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {reports?.length || 0} pending reports
          </p>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading...
            </div>
          ) : reports && reports.length > 0 ? (
            <ReportsList
              reports={reports}
              selectedId={selectedReportId}
              onSelect={setSelectedReportId}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
              <Inbox className="h-10 w-10 mb-2 opacity-50" />
              <p>No pending reports</p>
              <p className="text-xs mt-1">New reports will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Report Detail */}
      <div className="flex-1 overflow-y-auto bg-muted/5">
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
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a report to begin triage</p>
          </div>
        )}
      </div>
    </div>
  );
}

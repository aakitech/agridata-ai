"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ReportsList } from "./reports-list";
import { ReportDetail } from "./report-detail";
import { Loader2, Inbox, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

type TriageStatus = "PENDING_TRIAGE" | "VERIFIED" | "REJECTED";

export function TriageDashboard() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [status, setStatus] = useState<TriageStatus>("PENDING_TRIAGE");
  
  const { data: reports, isLoading } = api.reports.getAll.useQuery({ status });
  const selectedReport = reports?.find((r) => r.id === selectedReportId);

  // Auto-select first report if none selected and we have reports
  if (!selectedReportId && reports && reports.length > 0) {
    setSelectedReportId(reports[0]!.id);
  }

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Left Sidebar - Reports List */}
      <div className="w-[350px] border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b bg-background space-y-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Triage</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and verify crop reports
            </p>
          </div>
          
          <Tabs value={status} onValueChange={(v) => setStatus(v as TriageStatus)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="PENDING_TRIAGE" className="text-xs">Pending</TabsTrigger>
              <TabsTrigger value="VERIFIED" className="text-xs">Verified</TabsTrigger>
              <TabsTrigger value="REJECTED" className="text-xs">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="px-4 py-2 bg-muted/20 border-b flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {status === "PENDING_TRIAGE" && <Clock className="h-3 w-3" />}
            {status === "VERIFIED" && <CheckCircle2 className="h-3 w-3" />}
            {status === "REJECTED" && <XCircle className="h-3 w-3" />}
            {reports?.length || 0} reports
          </span>
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
              <p>No {status.toLowerCase().replace("_", " ")} reports</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Report Detail */}
      <div className="flex-1 overflow-y-auto bg-muted/5">
        {selectedReport ? (
          <ReportDetail
            key={selectedReport.id}
            report={selectedReport}
            onComplete={() => {
              // Auto-select next report or clear selection
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
            <p className="text-lg font-medium">Select a report to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

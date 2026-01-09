"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ReportsList } from "./reports-list";
import { ReportDetail } from "./report-detail";
import { Loader2, Inbox, CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "~/components/ui/button";

type TriageStatus = "PENDING_TRIAGE" | "VERIFIED" | "REJECTED";

export function TriageDashboard() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  // Get current user's role
  const { data: me } = api.users.getMe.useQuery();
  const userRole = me?.role ?? "officer";
  const isSuperAdmin = userRole === "super_admin";
  
  // Default to VERIFIED for org admins, PENDING_TRIAGE for super admins
  const [status, setStatus] = useState<TriageStatus>(isSuperAdmin ? "PENDING_TRIAGE" : "VERIFIED");
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);
  
  const { data: reports, isLoading } = api.reports.getAll.useQuery({ status, filterOrgId });
  const { data: orgs } = api.organizations.getAll.useQuery();
  
  const selectedReport = reports?.find((r) => r.id === selectedReportId);

  return (
    <div className="flex flex-col md:flex-row h-full bg-background text-foreground">
      {/* Left Sidebar - Reports List */}
      {/* On mobile: hide when report is selected. On desktop: always show */}
      <div className={`
        w-full md:w-[350px] 
        border-r md:border-r 
        border-b md:border-b-0 
        flex flex-col bg-muted/10
        ${selectedReportId ? 'hidden md:flex' : 'flex'}
      `}>
        <div className="p-4 border-b bg-background space-y-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isSuperAdmin ? "Triage" : "Review Reports"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSuperAdmin 
                ? "Review and verify crop reports" 
                : "Review reports and add annotations"}
            </p>
          </div>

          {/* Org Filter (Only show for super_admin with multiple orgs) */}
          {isSuperAdmin && orgs && orgs.length > 0 && (
             <Select value={filterOrgId ?? "all"} onValueChange={(val) => setFilterOrgId(val === "all" ? undefined : val)}>
                <SelectTrigger className="h-8 text-xs">
                   <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Organizations</SelectItem>
                   {orgs.map((org: { id: string; name: string }) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                   ))}
                </SelectContent>
             </Select>
          )}
          
          {/* Org display for org_admin */}
          {!isSuperAdmin && me?.organization && (
            <div className="text-xs px-2 py-1 bg-muted rounded">
              <span className="text-muted-foreground">Organization: </span>
              <span className="font-medium">{me.organization.name}</span>
            </div>
          )}
          
          {/* Status Tabs - Only show for super_admin */}
          {isSuperAdmin && (
            <Tabs value={status} onValueChange={(v) => setStatus(v as TriageStatus)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="PENDING_TRIAGE" className="text-xs">Pending</TabsTrigger>
                <TabsTrigger value="VERIFIED" className="text-xs">Verified</TabsTrigger>
                <TabsTrigger value="REJECTED" className="text-xs">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        
        <div className="px-4 py-2 bg-muted/20 border-b flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {isSuperAdmin && (
              <>
                {status === "PENDING_TRIAGE" && <Clock className="h-3 w-3" />}
                {status === "VERIFIED" && <CheckCircle2 className="h-3 w-3" />}
                {status === "REJECTED" && <XCircle className="h-3 w-3" />}
              </>
            )}
            {!isSuperAdmin && <CheckCircle2 className="h-3 w-3" />}
            {reports?.length || 0} {isSuperAdmin ? 'reports' : 'verified reports'}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
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
              <p>No {isSuperAdmin ? status.toLowerCase().replace("_", " ") : 'verified'} reports</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Report Detail */}
      <div className="flex-1 overflow-y-auto bg-muted/5 min-h-0">
        {selectedReport ? (
          <>
            {/* Mobile: Back button to return to list */}
            <div className="md:hidden sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedReportId(null)}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to reports</span>
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  Report #{selectedReport.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedReport.organization?.name || 'Report Details'}
                </p>
              </div>
            </div>
            <ReportDetail
              key={selectedReport.id}
              report={selectedReport}
              userRole={userRole}
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
          </>
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

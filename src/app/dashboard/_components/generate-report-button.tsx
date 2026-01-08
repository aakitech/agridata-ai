"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { FileDown, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, endOfDay, startOfDay } from "date-fns";

interface GenerateReportButtonProps {
  orgId?: string;
  orgSlug?: string;
  userRole: "super_admin" | "org_admin" | "officer";
  range?: "7d" | "30d";
}

export function GenerateReportButton({
  orgId,
  orgSlug,
  userRole,
  range = "7d",
}: GenerateReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate the date range based on the range prop
  const days = range === "30d" ? 30 : 7;
  const now = new Date();
  const endDate = endOfDay(now);
  const startDate = startOfDay(subDays(now, days));
  const dateRangeText = `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`;
  const rangeLabel = range === "30d" ? "Last 30 days" : "Last 7 days";

  // Only show button for org_admin or super_admin, and only for MPBC
  const shouldShow =
    (userRole === "org_admin" || userRole === "super_admin") &&
    orgSlug === "mpbc";

  const generateReport = api.reports.generateMpbcWeeklyReport.useMutation({
    onMutate: () => {
      setIsGenerating(true);
    },
    onSuccess: (data) => {
      try {
        // Convert base64 to blob and trigger download
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Report generated successfully");
      } catch (error) {
        console.error("Error downloading PDF:", error);
        toast.error("Failed to download report");
      } finally {
        setIsGenerating(false);
      }
    },
    onError: (error) => {
      console.error("Error generating report:", error);
      toast.error(error.message || "Failed to generate report");
      setIsGenerating(false);
    },
  });

  if (!shouldShow) {
    return null;
  }

  const handleGenerate = () => {
    generateReport.mutate({
      orgId,
      startDate,
      endDate,
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        variant="default"
        className="h-9 shadow-sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-4 w-4" />
            Generate Report
          </>
        )}
      </Button>
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/50 border border-border/50 text-[10px] text-muted-foreground transition-all hover:bg-secondary/80">
        <Calendar className="h-3 w-3 text-primary/70" />
        <span className="whitespace-nowrap">
          {rangeLabel}: <span className="text-foreground font-medium">{dateRangeText}</span>
        </span>
      </div>
    </div>
  );
}


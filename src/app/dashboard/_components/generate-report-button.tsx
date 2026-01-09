"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { FileDown, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, endOfDay, startOfDay } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

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
  const rangeLabel = range === "30d" ? "30 Days" : "7 Days";

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
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden md:flex items-center gap-1.5 px-3 h-8 rounded-md bg-muted/50 border text-[10px] text-muted-foreground transition-colors hover:bg-muted cursor-help">
              <Calendar className="h-3 w-3 text-primary/60" />
              <span className="whitespace-nowrap">
                {rangeLabel}: <span className="text-foreground font-semibold">{dateRangeText}</span>
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="text-[10px]">
            <p>Data range for the generated report</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        variant="default"
        className="h-8 md:h-9 transition-all active:scale-[0.95] shadow-sm font-bold text-xs"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="hidden sm:inline">Generating...</span>
            <span className="sm:hidden text-[10px]">...</span>
          </>
        ) : (
          <>
            <FileDown className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Generate Report</span>
            <span className="sm:hidden">Report</span>
          </>
        )}
      </Button>
    </div>
  );
}


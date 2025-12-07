"use client";

import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { Phone, Image as ImageIcon } from "lucide-react";

type Report = {
  id: string;
  mediaUrl: string | null;
  createdAt: Date;
  category: "PEST" | "DISEASE" | "WEATHER" | null;
  user?: {
    phoneNumber: string;
    languagePref: string | null;
  };
  media?: Array<{
    id: string;
    mediaUrl: string;
    contentType: string | null;
  }>;
};

interface ReportsListProps {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ReportsList({ reports, selectedId, onSelect }: ReportsListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {reports.map((report) => {
          // Get thumbnail (first media image or fallback to mediaUrl)
          const thumbnailUrl = report.media && report.media.length > 0
            ? report.media[0]!.mediaUrl
            : report.mediaUrl;

          return (
            <button
              key={report.id}
              onClick={() => onSelect(report.id)}
              className={cn(
                "w-full p-4 text-left transition-colors hover:bg-muted/50",
                selectedId === report.id && "bg-muted border-l-4 border-primary pl-3"
              )}
            >
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted border">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Report"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                  </span>
                  {report.category && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                      {report.category}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm font-medium leading-none truncate">
                  Report #{report.id.slice(0, 8)}
                </p>
                
                {report.user && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{report.user.phoneNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

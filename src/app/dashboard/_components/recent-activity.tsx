import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { MapPin, Bug, AlertTriangle, Calendar, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface ActivityProps {
  reports: Array<{
    id: string;
    createdAt: Date;
    description: string | null;
    severity: "NORMAL" | "WARNING" | "HIGH" | null;
    label: string | null;
    observedCount: number | null;
    mediaUrl: string | null;
    location: string | null;
    user: { fullName: string | null; phoneNumber: string | null } | null;
    organization: { name: string } | null;
  }>;
}

export function RecentActivity({ reports }: ActivityProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent Activity</h3>
      </div>
      <div className="space-y-4">
        {reports.map((report) => (
          <Dialog key={report.id}>
            <DialogTrigger asChild>
              <div className="flex items-start gap-4 p-3 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent/50 transition-colors cursor-pointer group">
                <Avatar className="h-9 w-9 mt-1">
                  <AvatarFallback className="text-xs">
                    {report.user?.fullName?.slice(0, 2).toUpperCase() || "CN"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                      {report.user?.fullName || report.user?.phoneNumber || "Unknown Scout"}
                    </p>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                     {report.organization && (
                        <Badge variant="outline" className="text-[10px] px-1 h-4 font-normal text-muted-foreground">
                            {report.organization.name}
                        </Badge>
                     )}
                     <div className="text-sm text-foreground">
                        Reported <span className="font-semibold">{report.observedCount ?? "?"} {report.label || "Pest"}</span>
                     </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    {report.severity && (
                        <Badge 
                          className={
                            report.severity === "HIGH"
                              ? "text-[10px] px-1.5 h-5 font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                              : report.severity === "WARNING"
                              ? "text-[10px] px-1.5 h-5 font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                              : "text-[10px] px-1.5 h-5 font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          }
                        >
                          {report.severity}
                        </Badge>
                     )}
                     
                     {/* Optional: Add location hint if available */}
                     <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        ID: {report.id.slice(0, 8)}
                     </div>
                  </div>
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Report Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                     {/* Header Info */}
                    <div className="flex items-center justify-between border-b pb-4">
                         <div className="space-y-1">
                             <div className="text-sm text-muted-foreground">Officer</div>
                             <div className="font-medium flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {report.user?.fullName || report.user?.phoneNumber || "Unknown"}
                             </div>
                         </div>
                         <div className="space-y-1 text-right">
                             <div className="text-sm text-muted-foreground">Date</div>
                             <div className="font-medium flex items-center justify-end gap-2">
                                {format(new Date(report.createdAt), "MMM d, yyyy HH:mm")}
                                <Calendar className="h-4 w-4" />
                             </div>
                         </div>
                    </div>

                    {/* Main Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Pest Detected</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <Bug className="h-5 w-5 text-primary" />
                                {report.label || "Unknown"}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">Observed Count</div>
                            <div className="text-lg font-bold">
                                {report.observedCount ?? "N/A"}
                            </div>
                        </div>
                    </div>

                    {/* Metadata */}
                     <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Severity Level</span>
                             <Badge 
                                className={
                                  report.severity === "HIGH"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                    : report.severity === "WARNING"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                                    : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                }
                            >
                                {report.severity ?? "UNKNOWN"}
                            </Badge>
                        </div>
                        
                        {report.location && (
                             <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Location</span>
                                <span className="text-sm font-mono text-xs truncate max-w-[200px]">{report.location}</span>
                            </div>
                        )}

                        {report.description && (
                            <div className="space-y-1 pt-2">
                                <span className="text-sm text-muted-foreground">Description/Notes</span>
                                <div className="p-2 bg-muted/20 rounded-md text-sm italic">
                                    "{report.description}"
                                </div>
                            </div>
                        )}
                        
                         {report.mediaUrl && (
                            <div className="space-y-1 pt-2">
                                <span className="text-sm text-muted-foreground">Media</span>
                                <div className="rounded-md overflow-hidden border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={report.mediaUrl} alt="Report media" className="w-full h-auto object-cover max-h-[300px]" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}

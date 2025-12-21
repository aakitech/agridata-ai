import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { MapPin } from "lucide-react";

interface ActivityProps {
  reports: Array<{
    id: string;
    createdAt: Date;
    description: string | null;
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
          <div key={report.id} className="flex items-start gap-4 p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">
                {report.user?.fullName?.slice(0, 2).toUpperCase() || "CN"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium leading-none">
                  {report.user?.fullName || report.user?.phoneNumber || "Unknown Scout"}
                </p>
                <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                 {report.organization && (
                    <Badge variant="secondary" className="text-[10px] px-1 h-4 font-normal">
                        {report.organization.name}
                    </Badge>
                 )}
                 <div className="text-xs text-muted-foreground line-clamp-1">
                    submitted a report
                 </div>
              </div>

               {/* Optional: Add location hint if available */}
               <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  ID: {report.id.slice(0, 8)}
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Loader2 } from "lucide-react";

export default function ReportsLoading() {
  return (
    <div className="h-full min-h-[60vh] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          <div
            className="absolute inset-3 rounded-full border-4 border-transparent border-r-primary/60 animate-spin"
            style={{ animationDuration: "1.2s", animationDirection: "reverse" }}
          />
          <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-primary animate-spin" />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium">Loading reports...</p>
          <p className="text-xs text-muted-foreground">Preparing dashboard data and filters</p>
        </div>
      </div>
    </div>
  );
}
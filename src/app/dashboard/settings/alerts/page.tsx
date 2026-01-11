"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Loader2 } from "lucide-react";
import { AlertThresholdsTable } from "./_components/alert-thresholds-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";

export default function AlertsSettingsPage() {
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);

  // Fetch current user
  const { data: me } = api.users.getMe.useQuery();
  
  // Fetch organizations (for super admin)
  const { data: orgs } = api.organizations.getAll.useQuery();

  // Fetch thresholds
  const { data: thresholds, isLoading, refetch } = api.alerts.getOrgThresholds.useQuery({
    orgId: filterOrgId,
  });

  return (
    <div className="space-y-8 p-1 sm:p-2 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alert Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Define when a pest count becomes Normal, Warning, or High Alert for your organization.
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            These thresholds are used to flag reports on the dashboard and map.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Org Filter (Only show for super_admin) */}
          {me?.role === "super_admin" && orgs && orgs.length > 0 && (
            <Select
              value={filterOrgId ?? "all"}
              onValueChange={(val) => setFilterOrgId(val === "all" ? undefined : val)}
            >
              <SelectTrigger className="w-[180px] sm:w-[200px] h-9">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {me?.role !== "super_admin" && me?.organization && (
            <Badge variant="outline" className="h-9 px-3 text-sm font-normal">
              {me.organization.name}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading thresholds...</span>
        </div>
      ) : (
        <AlertThresholdsTable
          thresholds={thresholds ?? []}
          onUpdate={refetch}
          orgId={filterOrgId}
        />
      )}
    </div>
  );
}




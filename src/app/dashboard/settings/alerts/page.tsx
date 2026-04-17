"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { AlertThresholdsTable } from "./_components/alert-thresholds-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";

export default function AlertsSettingsPage() {
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);

  const { data: me } = api.users.getMe.useQuery();
  const { data: orgs } = api.organizations.getAll.useQuery();
  const selectedOrgId =
    me?.role === "super_admin" ? filterOrgId : me?.organization?.id;

  const thresholdsQuery = api.alerts.getOrgThresholds.useQuery(
    selectedOrgId ? { orgId: selectedOrgId } : undefined,
    {
      enabled:
        !!me &&
        (me.role === "org_admin" || (me.role === "super_admin" && !!selectedOrgId)),
    }
  );
  const pestConfigsQuery = api.pestConfigs.list.useQuery(
    selectedOrgId ? { orgId: selectedOrgId } : undefined,
    {
      enabled:
        !!me &&
        (me.role === "org_admin" || (me.role === "super_admin" && !!selectedOrgId)),
    }
  );

  return (
    <div className="space-y-8 p-1 sm:p-2 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Alert Thresholds</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Adjust the severity cutoffs that determine when pest reports show as normal, warning, or high.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Keep this simple for organization admins. Pest workflow design is managed separately.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {me?.role === "super_admin" && orgs && orgs.length > 0 && (
            <Select
              value={filterOrgId ?? "none"}
              onValueChange={(val) => setFilterOrgId(val === "none" ? undefined : val)}
            >
              <SelectTrigger className="h-9 w-[180px] sm:w-[220px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select organization</SelectItem>
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

      {me?.role === "super_admin" && !selectedOrgId ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          Select an organization to manage its alert thresholds.
        </div>
      ) : thresholdsQuery.isLoading ? (
        <div className="rounded-lg border p-8 text-sm text-muted-foreground">
          Loading alert thresholds...
        </div>
      ) : pestConfigsQuery.isLoading ? (
        <div className="rounded-lg border p-8 text-sm text-muted-foreground">
          Loading pest options...
        </div>
      ) : (
        <AlertThresholdsTable
          thresholds={thresholdsQuery.data ?? []}
          orgId={selectedOrgId}
          pestOptions={(pestConfigsQuery.data ?? []).map((config) => ({
            key: config.key,
            label: config.label,
          }))}
          onUpdate={() => void thresholdsQuery.refetch()}
        />
      )}
    </div>
  );
}

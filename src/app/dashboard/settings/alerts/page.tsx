"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { PestConfigsManager } from "./_components/pest-configs-manager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";

export default function AlertsSettingsPage() {
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);

  // Fetch current user
  const { data: me } = api.users.getMe.useQuery();
  
  // Fetch organizations (for super admin)
  const { data: orgs } = api.organizations.getAll.useQuery();
  const selectedOrgId =
    me?.role === "super_admin" ? filterOrgId : me?.organization?.id;

  return (
    <div className="space-y-8 p-1 sm:p-2 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pest Configurations</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Configure MPBC pests, observation methods, fields, severity rules, and alert behavior for your organization.
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            This replaces the old threshold-only model with method-aware multi-pest configuration.
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

      {me?.role === "super_admin" && !selectedOrgId ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          Select an organization to manage its pest configurations.
        </div>
      ) : (
        <PestConfigsManager orgId={selectedOrgId} />
      )}
    </div>
  );
}




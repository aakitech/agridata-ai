"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { PestConfigsManager } from "../alerts/_components/pest-configs-manager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

export default function PestConfigurationsPage() {
  const [filterOrgId, setFilterOrgId] = useState<string | undefined>(undefined);

  const { data: me } = api.users.getMe.useQuery();
  const { data: orgs } = api.organizations.getAll.useQuery();

  if (me?.role && me.role !== "super_admin") {
    return (
      <div className="space-y-4 p-1 sm:p-2 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pest Configurations</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            This area is reserved for platform-level pest workflow management.
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          Only super admins can edit pest configurations. Organization admins should use Alert Thresholds for severity changes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-1 sm:p-2 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pest Configurations</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Manage pest workflows, observation methods, fields, and severity rule logic across organizations.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            This is a platform-level editor for super admins only.
          </p>
        </div>

        <Select
          value={filterOrgId ?? "none"}
          onValueChange={(val) => setFilterOrgId(val === "none" ? undefined : val)}
        >
          <SelectTrigger className="h-9 w-[180px] sm:w-[220px]">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select organization</SelectItem>
            {orgs?.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!filterOrgId ? (
        <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          Select an organization to manage its pest configurations.
        </div>
      ) : (
        <PestConfigsManager orgId={filterOrgId} />
      )}
    </div>
  );
}

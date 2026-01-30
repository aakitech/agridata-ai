"use client";

import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Filter, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface FilterBarProps {
  severity: "ALL" | "HIGH" | "WARNING" | "NORMAL";
  onSeverityChange: (severity: "ALL" | "HIGH" | "WARNING" | "NORMAL") => void;
  officerId: string | null;
  onOfficerChange: (officerId: string | null) => void;
  orgId: string | null;
  onOrgChange: (orgId: string | null) => void;
  organizations: Array<{ id: string; name: string }> | undefined;
  userRole: string | undefined;
  userOrgId: string | undefined;
}

export function FilterBar({
  severity,
  onSeverityChange,
  officerId,
  onOfficerChange,
  orgId,
  onOrgChange,
  organizations,
  userRole,
  userOrgId,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filter by:</span>
      </div>

      {/* Severity Filter */}
      <div className="flex items-center gap-1.5">
        <Badge
          variant={severity === "ALL" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onSeverityChange("ALL")}
        >
          All
        </Badge>
        <Badge
          variant={severity === "HIGH" ? "destructive" : "outline"}
          className="cursor-pointer"
          onClick={() => onSeverityChange("HIGH")}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          High
        </Badge>
        <Badge
          variant={severity === "WARNING" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onSeverityChange("WARNING")}
        >
          <AlertCircle className="h-3 w-3 mr-1" />
          Warning
        </Badge>
        <Badge
          variant={severity === "NORMAL" ? "secondary" : "outline"}
          className="cursor-pointer"
          onClick={() => onSeverityChange("NORMAL")}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Normal
        </Badge>
      </div>

      {/* Organization Filter (super_admin only) */}
      {userRole === "super_admin" && organizations && organizations.length > 0 && (
        <Select
          value={orgId ?? "all"}
          onValueChange={(v) => onOrgChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

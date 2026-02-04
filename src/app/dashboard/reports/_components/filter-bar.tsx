"use client";

import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Filter, AlertTriangle, CheckCircle, AlertCircle, Search } from "lucide-react";

interface FilterBarProps {
  viewMode: "grouped" | "list";
  severity: "ALL" | "HIGH" | "WARNING" | "NORMAL";
  onSeverityChange: (severity: "ALL" | "HIGH" | "WARNING" | "NORMAL") => void;
  officerId: string | null;
  onOfficerChange: (officerId: string | null) => void;
  orgId: string | null;
  onOrgChange: (orgId: string | null) => void;
  organizations: Array<{ id: string; name: string }> | undefined;
  officers: Array<{ id: string; fullName: string | null; phoneNumber: string | null }> | undefined;
  userRole: string | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  pest: string | null;
  onPestChange: (value: string | null) => void;
  pestOptions: string[] | undefined;
  listSort: "DATE_DESC" | "DATE_ASC";
  onListSortChange: (sort: "DATE_DESC" | "DATE_ASC") => void;
}

export function FilterBar({
  viewMode,
  severity,
  onSeverityChange,
  officerId,
  onOfficerChange,
  orgId,
  onOrgChange,
  organizations,
  officers,
  userRole,
  search,
  onSearchChange,
  pest,
  onPestChange,
  pestOptions,
  listSort,
  onListSortChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filter by:</span>
      </div>

      {/* Quick Search */}
      <div className="relative w-full sm:w-auto">
        <Search className="h-4 w-4 text-muted-foreground absolute left-2 top-2" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search officer or pest…"
          className="h-8 pl-8 w-full sm:w-[220px] text-xs"
        />
      </div>

      {/* Severity Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
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

      {/* Officer Filter */}
      {officers && officers.length > 0 && (
        <Select
          value={officerId ?? "all"}
          onValueChange={(v) => onOfficerChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
            <SelectValue placeholder="All Officers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {officers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName || u.phoneNumber || "Unknown"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Pest filter */}
      {pestOptions && pestOptions.length > 0 && (
        <Select
          value={pest ?? "all"}
          onValueChange={(v) => onPestChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
            <SelectValue placeholder="All Pests" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pests</SelectItem>
            {pestOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p === "__unknown__" ? "Unknown" : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Organization Filter (super_admin only) */}
      {userRole === "super_admin" && organizations && organizations.length > 0 && (
        <Select
          value={orgId ?? "all"}
          onValueChange={(v) => onOrgChange(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
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

      {/* List sorting */}
      {viewMode === "list" && (
        <Select value={listSort} onValueChange={(v) => onListSortChange(v as "DATE_DESC" | "DATE_ASC")}>
          <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DATE_DESC">Newest first</SelectItem>
            <SelectItem value="DATE_ASC">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

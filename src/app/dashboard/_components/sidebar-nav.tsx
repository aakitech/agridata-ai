"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Building2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Tooltip as ShadTooltip,
  TooltipContent as ShadTooltipContent,
  TooltipProvider as ShadTooltipProvider,
  TooltipTrigger as ShadTooltipTrigger,
} from "~/components/ui/tooltip";

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
}

function NavLink({ href, icon: Icon, label }: NavLinkProps) {
  const pathname = usePathname();
  // Check if active: exact match for /dashboard, or starts with href for others
  const isActive = href === "/dashboard" 
    ? pathname === "/dashboard" 
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <ShadTooltip>
      <ShadTooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-all md:h-8 md:w-8",
            isActive 
              ? "bg-primary text-primary-foreground shadow-sm scale-110" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="sr-only">{label}</span>
        </Link>
      </ShadTooltipTrigger>
      <ShadTooltipContent side="right">
        <p>{label}</p>
      </ShadTooltipContent>
    </ShadTooltip>
  );
}

export function SidebarNav({ role }: { role: string }) {
  return (
    <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
      <NavLink
        href="/dashboard"
        icon={LayoutDashboard}
        label="Dashboard"
      />
      {(role === "super_admin" || role === "org_admin") && (
        <NavLink
          href="/dashboard/triage"
          icon={ClipboardList}
          label="Triage"
        />
      )}
      {role === "super_admin" && (
        <>
          <NavLink
            href="/dashboard/admin/organizations"
            icon={Building2}
            label="Organizations"
          />
          <NavLink
            href="/dashboard/admin/users"
            icon={Users}
            label="User Management"
          />
        </>
      )}
    </nav>
  );
}

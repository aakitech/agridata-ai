"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  users: "User Management",
  triage: "Triage",
  organizations: "Organizations",
};

// Segments that don't have their own page and should just be labels
const nonClickableSegments = ["admin"];

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1 && segments[0] === "dashboard") {
      return null; // Don't show on root dashboard
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground pb-4">
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const isNonClickable = nonClickableSegments.includes(segment);
        const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

        // Skip "dashboard" if it's the first segment to avoid "Dashboard / Dashboard"
        if (segment === "dashboard" && index === 0) return null;

        return (
          <Fragment key={href}>
            <ChevronRight className="h-4 w-4 shrink-0" />
            {isLast || isNonClickable ? (
              <span className={`font-medium ${isLast ? 'text-foreground' : 'text-muted-foreground/60 cursor-default'} truncate max-w-[150px]`}>
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

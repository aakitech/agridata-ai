"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import {
  Tooltip as ShadTooltip,
  TooltipContent as ShadTooltipContent,
  TooltipProvider as ShadTooltipProvider,
  TooltipTrigger as ShadTooltipTrigger,
} from "~/components/ui/tooltip";
import { getNavItems } from "./nav-items";

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
}

function NavLink({ href, icon: Icon, label }: NavLinkProps) {
  const pathname = usePathname();
  // Check if active: exact match for /dashboard, or starts with href for others
  const isActive =
    href === "/dashboard"
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
  const navItems = getNavItems(role);
  return (
    <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
      {navItems.map((item) => (
        <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
      ))}
    </nav>
  );
}

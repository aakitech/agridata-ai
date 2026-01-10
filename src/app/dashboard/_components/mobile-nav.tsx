"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Menu, LayoutDashboard, ClipboardList, Bell, Building2, Users } from "lucide-react";
import { UserAccountNav } from "./user-account-nav";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

interface MobileNavProps {
  user: {
    fullName: string | null;
    email: string | null;
    role: string;
    organization?: {
      name: string;
    } | null;
  };
}

export function MobileNav({ user }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex sm:hidden items-center justify-between w-full h-14 px-4 border-b bg-background sticky top-0 z-[100] shadow-sm">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0 border-none shadow-2xl" align="start" side="bottom" sideOffset={8}>
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                Main Navigation
              </h3>
            </div>
            <div className="py-2 px-2 bg-background">
                <div className="space-y-1.5">
                    <MobileNavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} onClick={() => setOpen(false)} />
                    {(user.role === "super_admin" || user.role === "org_admin") && (
                        <>
                            <MobileNavLink href="/dashboard/triage" icon={ClipboardList} label="Triage" active={pathname.startsWith("/dashboard/triage")} onClick={() => setOpen(false)} />
                            <MobileNavLink href="/dashboard/settings/alerts" icon={Bell} label="Alert Settings" active={pathname.startsWith("/dashboard/settings/alerts")} onClick={() => setOpen(false)} />
                        </>
                    )}
                    {user.role === "super_admin" && (
                        <>
                            <MobileNavLink href="/dashboard/admin/organizations" icon={Building2} label="Organizations" active={pathname.startsWith("/dashboard/admin/organizations")} onClick={() => setOpen(false)} />
                            <MobileNavLink href="/dashboard/admin/users" icon={Users} label="User Management" active={pathname.startsWith("/dashboard/admin/users")} onClick={() => setOpen(false)} />
                        </>
                    )}
                </div>
            </div>
          </PopoverContent>
        </Popover>
        <span className="font-bold text-lg tracking-tight">AgriData <span className="text-primary italic">AI</span></span>
      </div>

      <UserAccountNav user={user} />
    </div>
  );
}

function MobileNavLink({ href, icon: Icon, label, active, onClick }: { href: string, icon: any, label: string, active: boolean, onClick?: () => void }) {
    return (
        <Link 
            href={href} 
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all",
                active 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            <Icon className="h-5 w-5" />
            {label}
        </Link>
    )
}

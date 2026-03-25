import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Building2,
  Bell,
  FileText,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export function getNavItems(role: string): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/reports", label: "Reports", icon: FileText },
  ];

  if (role === "super_admin" || role === "org_admin") {
    items.push(
      { href: "/dashboard/triage", label: "Triage", icon: ClipboardList },
      { href: "/dashboard/settings/alerts", label: "Pest Configurations", icon: Bell }
    );
  }

  if (role === "super_admin") {
    items.push(
      { href: "/dashboard/admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/dashboard/admin/users", label: "User Management", icon: Users }
    );
  }

  return items;
}

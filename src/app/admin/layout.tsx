
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: "Field Officers", href: "/admin/users" },
    { name: "Organizations", href: "/admin/organizations" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b bg-white">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <nav className="flex space-x-4">
                {tabs.map((tab) => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === tab.href
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    )}
                >
                    {tab.name}
                </Link>
                ))}
            </nav>
        </div>
      </header>
      <main className="flex-1 bg-gray-50/50">
        {children}
      </main>
    </div>
  );
}

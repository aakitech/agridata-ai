import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "../login/actions";
import { createTRPCContext } from "~/server/api/trpc";
import { Breadcrumbs } from "~/components/shared/breadcrumbs";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileNav } from "./_components/mobile-nav";
import { UserAccountNav } from "./_components/user-account-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const ctx = await createTRPCContext({ headers: await headers() });
  
  if (!ctx.user) {
      redirect("/login");
  }

  if (!ctx.appUser) {
      redirect("/onboarding");
  }

  // Prep user data for nav components
  const navUser = {
    fullName: ctx.appUser.fullName,
    email: ctx.appUser.email,
    role: ctx.appUser.role,
    organization: (ctx.appUser as any).organization
  };

  return (
    <div className="flex flex-col sm:flex-row h-full w-full bg-muted/40">
      {/* Mobile Top Nav */}
      <MobileNav user={navUser as any} />

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-16 flex-col border-r bg-background sm:flex shadow-xl">
        <div className="flex h-16 items-center justify-center border-b">
           <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <LayoutDashboard className="h-6 w-6" />
           </div>
        </div>
        
        <div className="flex-1 py-6">
          <SidebarNav role={ctx.appUser.role} />
        </div>

        <div className="mt-auto flex flex-col items-center gap-4 py-6 border-t bg-muted/5">
           <UserAccountNav user={navUser as any} side="right" />
        </div>
      </aside>

      <div className="flex flex-col sm:pl-16 w-full min-h-screen">
        <main className="flex-1 flex flex-col gap-4 p-4 sm:px-8 sm:py-0">
          <header className="flex h-14 items-center gap-4 px-2 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:pt-6">
            <Breadcrumbs />
          </header>
          
          <div className="flex-1 mt-2">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

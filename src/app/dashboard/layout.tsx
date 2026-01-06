import Link from "next/link";
import { LayoutDashboard, Settings, ClipboardList, LogOut, Users, Building2 } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logout } from "../login/actions";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { Breadcrumbs } from "~/components/shared/breadcrumbs";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const ctx = await createTRPCContext({ headers: await headers() });
  
  if (!ctx.user) {
      // Not logged in to Supabase at all
      redirect("/login");
  }

  if (!ctx.appUser) {
      // Logged in to Supabase, but no internal profile yet
      redirect("/onboarding");
  }

  return (
    <div className="flex h-full w-full bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <SidebarNav role={ctx.appUser.role} />
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
           <div className="flex flex-col items-center gap-1 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] font-bold uppercase text-muted-foreground tracking-tighter">
                {ctx.appUser.role.replace('_', ' ')}
              </span>
           </div>
           <form action={logout}>
              <button 
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Sign Out</span>
              </button>
           </form>
        </nav>
      </aside>
      <div className="flex flex-col sm:gap-4 sm:pl-14 w-full h-full">
        <main className="flex-1 flex flex-col gap-4 p-4 sm:px-6 sm:py-0 overflow-hidden">
          <div className="pt-4 px-2">
            <Breadcrumbs />
          </div>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

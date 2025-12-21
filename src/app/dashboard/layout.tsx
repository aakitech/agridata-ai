import Link from "next/link";
import { LayoutDashboard, Settings, ClipboardList } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

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
    <div className="flex h-screen w-full bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="/dashboard"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <LayoutDashboard className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">Dashboard</span>
          </Link>
          <Link
            href="/triage"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="sr-only">Triage</span>
          </Link>
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
          >
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Link>
        </nav>
      </aside>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 w-full">
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

import { HydrateClient } from "~/trpc/server";
import { headers } from "next/headers";
import { createTRPCContext } from "~/server/api/trpc";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  LayoutDashboard,
  LogIn,
  MessageSquare,
  MapPin,
  Shield,
  Zap,
  Leaf,
  Sparkles,
  MessageCircle,
  ArrowRight,
  BarChart3,
  Bell,
} from "lucide-react";

export default async function Home() {
  const ctx = await createTRPCContext({ headers: await headers() });
  const user = ctx.user;

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">
              AgriData
            </span>
            <span className="text-xl font-bold tracking-tight text-primary">
              AI
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Features
            </a>
            <a
              href="#impact"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Impact
            </a>
            <a
              href="#about"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              About
            </a>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button asChild variant="default" size="default">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors hidden sm:inline"
                >
                  Sign In
                </Link>
                <Button asChild variant="default" size="default">
                  <Link href="/login" className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex flex-col items-center px-4 py-20 sm:py-28 text-center">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Closed beta • Pilot
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
              AgriData{" "}
              <span className="text-primary inline-flex items-baseline gap-1">
                AI
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Empowering agriculture with real-time{" "}
              <span className="text-primary font-semibold">data</span> and
              AI-driven insights. Streamline your pest and disease reporting
              directly through WhatsApp.
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Currently in closed beta: we&apos;re running a pilot with selected
              partners in Zimbabwe. Access is by invitation only.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              {user ? (
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-8 text-base font-medium rounded-lg"
                >
                  <Link href="/dashboard" className="flex items-center gap-2">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-8 text-base font-medium rounded-lg"
                  >
                    <a
                      href="mailto:software@aakitech.com?subject=AgriData%20AI%20-%20Request%20an%20invitation"
                      className="flex items-center gap-2"
                    >
                      Request an invitation
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 px-8 text-base font-medium rounded-lg border-border bg-background"
                    asChild
                  >
                    <a href="#features" className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      Learn More
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Pilot scope */}
          <div className="mt-24 text-center">
            <p className="text-sm text-muted-foreground">
              Running our pilot with agricultural organisations in Zimbabwe
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="border-t bg-muted/30 py-20 sm:py-28 px-4 scroll-mt-20"
        >
          <div className="container max-w-5xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary text-center mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-4">
              Everything you need to protect your crops
            </h2>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14">
              From field reporting to data visualization, we provide the tools
              to monitor and respond to agricultural threats.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  WhatsApp Bot
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Our primary ingestion channel. Send messages, photos, and
                  locations to start reporting pests and diseases instantly.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Real-time Dashboard
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Visualize your data with interactive maps and charts. Track
                  outbreaks and trends across your organization in real-time.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Secure & Private
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Enterprise-grade security for your agricultural data.
                  Multi-tenancy support ensures your data stays within your
                  organization.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  AI-Powered Analysis
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Advanced machine learning identifies pest species and disease
                  patterns from photos with 95%+ accuracy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section
          id="impact"
          className="border-t py-20 sm:py-28 px-4 scroll-mt-20"
        >
          <div className="container max-w-5xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
              Impact
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              From field to insight, faster
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              AgriData AI helps extension officers and cooperatives spot threats
              early, prioritize response, and keep stakeholders informed—all
              from the devices they already use. We&apos;re testing these
              outcomes with pilot partners in Zimbabwe.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-14">
              <div className="p-6 rounded-2xl border bg-card">
                <BarChart3 className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold text-foreground mb-2">
                  Real-time visibility
                </h3>
                <p className="text-muted-foreground text-sm">
                  See where pests and diseases are spreading as reports come in.
                </p>
              </div>
              <div className="p-6 rounded-2xl border bg-card">
                <Bell className="w-10 h-10 text-amber-600 mx-auto mb-4" />
                <h3 className="font-bold text-foreground mb-2">Smart alerts</h3>
                <p className="text-muted-foreground text-sm">
                  Get notified when counts cross thresholds or new hotspots
                  appear.
                </p>
              </div>
              <div className="p-6 rounded-2xl border bg-card">
                <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold text-foreground mb-2">
                  Org-level control
                </h3>
                <p className="text-muted-foreground text-sm">
                  Data stays within your organization; you decide who sees what.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section
          id="about"
          className="border-t bg-muted/30 py-20 sm:py-28 px-4 scroll-mt-20"
        >
          <div className="container max-w-3xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
              About
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Built for agriculture, powered by AI
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              AgriData AI is in closed beta as we run a pilot with chosen
              partners in Zimbabwe. Access is by invitation only—we&apos;re not
              open for general sign-up yet.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              AgriData AI is a crop-protection platform that connects field
              scouts, cooperatives, and decision-makers. Reports flow in via
              WhatsApp; dashboards and alerts help teams act before outbreaks
              spread. We focus on simplicity, privacy, and reliability so you
              can focus on protecting harvests.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="default" size="lg">
                <a
                  href="mailto:software@aakitech.com?subject=AgriData%20AI%20-%20Request%20an%20invitation"
                  className="flex items-center gap-2"
                >
                  Request an invitation
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Contact us at{" "}
              <a
                href="mailto:software@aakitech.com"
                className="text-primary font-medium hover:underline"
              >
                software@aakitech.com
              </a>{" "}
              to learn about joining the pilot.
            </p>
          </div>
        </section>
      </main>
    </HydrateClient>
  );
}

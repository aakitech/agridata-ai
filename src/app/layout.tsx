import "~/styles/globals.css";
import "leaflet/dist/leaflet.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { Toaster } from "~/components/ui/sonner";
import { PostHogProvider } from "~/lib/observability/posthog-provider";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "AgriData AI Triage",
  description: "Triage Dashboard for AgriData AI",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

import { TooltipProvider } from "~/components/ui/tooltip";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrainsMono.variable}`}>
      <body className="flex flex-col h-screen overflow-hidden">
        <TRPCReactProvider>
          <PostHogProvider>
            <TooltipProvider>
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                {children}
              </div>
              <footer className="py-4 text-center text-sm text-muted-foreground bg-background border-t print:hidden shrink-0">
                © {new Date().getFullYear()} AgriData AI. All rights reserved.
              </footer>
              <Toaster />
            </TooltipProvider>
          </PostHogProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

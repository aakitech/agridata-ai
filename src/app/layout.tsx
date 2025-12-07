import "~/styles/globals.css";
import "leaflet/dist/leaflet.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "~/components/ui/sonner";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="flex flex-col min-h-screen">
        <TRPCReactProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <footer className="py-2 text-center text-xs text-muted-foreground bg-muted/20 border-t print:hidden">
            AgriData AI
          </footer>
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}

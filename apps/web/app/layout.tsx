import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { LanguageProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "900"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Openvoiss — AI agents for your agency",
  description: "Open source platform to build and manage AI agents.",
  icons: { icon: "/brand/only-logo.png", apple: "/brand/only-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${inter.variable}`}>
        <LanguageProvider>
          <TooltipProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </TooltipProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans, Inter, Manrope } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { LanguageProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider } from "@/components/motion-provider";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const ibmPlexSansHeading = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-heading" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "900"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Openvoiss — AI agents for your agency",
  description: "Open source platform to build and manage AI agents.",
  icons: { icon: "/brand/only-logo.png", apple: "/brand/only-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${ibmPlexSansHeading.variable} ${geistMono.variable} ${geist.variable} ${inter.variable} font-sans antialiased`}
    >
      <body>
        <MotionProvider>
          <LanguageProvider>
            <TooltipProvider>
              <ToastProvider>
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </TooltipProvider>
          </LanguageProvider>
        </MotionProvider>
      </body>
    </html>
  );
}

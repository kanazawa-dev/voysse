import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const ibmPlexSansHeading = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-heading" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Openvoiss — Source-available AI agents for your agency",
  description: "Self-hosted platform to build and manage AI agents for your clients. FSL-1.1-MIT licensed.",
  icons: { icon: "/brand/only-logo.png", apple: "/brand/only-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${ibmPlexSansHeading.variable} ${geistMono.variable} font-sans antialiased`}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

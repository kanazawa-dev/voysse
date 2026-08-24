import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "900"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Openvoiss — Open source AI agents for your agency",
  description: "Self-hosted platform to build and manage AI agents for your clients. MIT licensed.",
  icons: { icon: "/brand/only-logo.png", apple: "/brand/only-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${inter.variable}`}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

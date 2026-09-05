import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";


export const metadata: Metadata = {
  title: "Voysse — Source-available AI agents for your agency",
  description: "Self-hosted platform to build and manage AI agents for your clients. FSL-1.1-MIT licensed.",
  icons: { icon: "/brand/only-logo.png", apple: "/brand/only-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className="font-sans antialiased"
    >
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

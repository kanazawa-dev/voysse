import type { Metadata } from "next";
import "./globals.css";
import "./identity.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { LanguageProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider } from "@/components/motion-provider";



export const metadata: Metadata = {
  title: "Voysse — AI agents for your agency",
  description: "Open source platform to build and manage AI agents.",
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

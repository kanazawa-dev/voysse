"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import type { User } from "@/types";

// Extra path prefixes served without a session (comma-separated, baked at
// build). Lets a deployment add public pages without patching the shell.
const EXTRA_PUBLIC_PATHS = (process.env.NEXT_PUBLIC_PUBLIC_PATHS || "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(pathname !== "/login");
  const isLogin = pathname === "/login";
  const isPortal = pathname.startsWith("/portal/");
  const isWidget = pathname.startsWith("/widget/");
  const isExtraPublic = EXTRA_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isBare = isLogin || isPortal || isWidget || isExtraPublic;

  useEffect(() => {
    if (isBare) { setLoading(false); return; }
    setLoading(true);
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [isBare, pathname, router]);

  if (isBare) return <>{children}</>;
  if (loading || !user) return <div className="app-loader"><span className="openvoiss-icon"><img src="/brand/only-logo.png" alt="" /></span><span>{t("shell.loading")}</span></div>;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="font-semibold">Openvoiss</span>
        </header>
        <main className="main-content">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

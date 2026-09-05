"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { AlertsBell } from "@/components/alerts-bell";
import { AppSidebar } from "@/components/app-sidebar";
import { BloubAvatar } from "@/components/bloub-avatar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  const isLogin = ["/login", "/forgot-password", "/reset-password", "/accept-invitation"].includes(pathname);
  const isPortal = pathname.startsWith("/portal/");
  const isWidget = pathname.startsWith("/widget/");
  // The admin panel is a separate Voysse-team-only auth system (its own
  // cookie, its own /api/admin/auth/me) -- it must never go through the
  // agency-user session check below.
  const isAdmin = pathname.startsWith("/admin");
  const isExtraPublic = EXTRA_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isBare = isLogin || isPortal || isWidget || isAdmin || isExtraPublic;

  useEffect(() => {
    if (isBare) {
      setSidebarOpen(null);
      return;
    }

    const sidebarCookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("sidebar_state="))
      ?.split("=")[1];
    setSidebarOpen(sidebarCookie !== "false");
  }, [isBare]);

  useEffect(() => {
    if (isBare) { setLoading(false); return; }
    setLoading(true);
    api<User>("/auth/me")
      .then((current) => {
        setUser(current);
        if (current.role === "operator" && pathname !== "/inbox") router.replace("/inbox");
      })
      .catch((err) => router.replace(err instanceof ApiError && err.message === "agency_pending_approval" ? "/login?pending=1" : "/login"))
      .finally(() => setLoading(false));
  }, [isBare, pathname, router]);

  if (isBare) return <>{children}</>;
  if (loading || !user || sidebarOpen === null) return <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground"><BloubAvatar size={64} mood="thinking" /><span>{t("shell.loading")}</span></div>;

  if (user.role === "operator" && pathname !== "/inbox") return null;

  const currentSection = pathname === "/"
    ? "Dashboard"
    : pathname
      .split("/")
      .filter((segment) => segment && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment))
      .map((segment) => segment.replaceAll("-", " "))
      .at(-1) ?? "Dashboard";

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar user={user} />
      <SidebarInset className="cy-workspace">
        <header className="cy-workspace-topbar flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbPage className="capitalize">{currentSection}</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-3 px-4">{user.role === "admin" && <AlertsBell />}</div>
        </header>
        <main className="cy-workspace-content flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

"use client"

import * as React from "react"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Bot,
  Building2,
  CreditCard,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  Radio,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react"
import { useT } from "@/lib/i18n";
import type { User } from "@/types";

const EXTRA_NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  wallet: Wallet,
  "credit-card": CreditCard,
  billing: Wallet,
  sparkles: Sparkles,
};

const EXTRA_NAV = (process.env.NEXT_PUBLIC_EXTRA_NAV || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [label, href, icon] = entry.split("|").map((part) => (part || "").trim());
    return { label, href, icon: EXTRA_NAV_ICONS[icon] || Wallet };
  })
  .filter((item) => item.label && item.href);

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const t = useT();
  const pathname = usePathname();

  const mainNav: { title: string; url: string; icon: React.ElementType; isActive?: boolean }[] = [
    { title: t("nav.home"), url: "/", icon: LayoutDashboard, isActive: pathname === "/" },
    { title: t("nav.clients"), url: "/clients", icon: Building2, isActive: pathname.startsWith("/clients") },
    { title: t("nav.agents"), url: "/agents", icon: Bot, isActive: pathname.startsWith("/agents") },
    { title: t("nav.inbox"), url: "/inbox", icon: Inbox, isActive: pathname.startsWith("/inbox") },
    { title: t("nav.playground"), url: "/playground", icon: MessageSquareText, isActive: pathname.startsWith("/playground") },
    { title: t("nav.channels"), url: "/channels", icon: Radio, isActive: pathname.startsWith("/channels") },
    { title: t("nav.settings"), url: "/settings", icon: Settings, isActive: pathname.startsWith("/settings") },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher agency={user.agency} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav} />
        {EXTRA_NAV.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.section")}</SidebarGroupLabel>
            <SidebarMenu>
              {EXTRA_NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.label}>
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

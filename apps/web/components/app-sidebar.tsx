"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  Users,
} from "lucide-react"
import { useT, useLanguage } from "@/lib/i18n"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import type { User } from "@/types"

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
    const [label, href, icon] = entry.split("|").map((part) => (part || "").trim())
    return { label, href, icon: EXTRA_NAV_ICONS[icon] || Wallet }
  })
  .filter((item) => item.label && item.href);

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const t = useT()
  const { lang: language } = useLanguage()
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  const mainNav: { title: string; url: string; icon: React.ComponentType<{ className?: string }>; isActive?: boolean }[] = [
    { title: t("nav.home"), url: "/", icon: LayoutDashboard, isActive: pathname === "/" },
    { title: t("nav.clients"), url: "/clients", icon: Building2, isActive: pathname.startsWith("/clients") },
    { title: t("nav.agents"), url: "/agents", icon: Bot, isActive: pathname.startsWith("/agents") },
    { title: t("nav.inbox"), url: "/inbox", icon: Inbox, isActive: pathname.startsWith("/inbox") },
    { title: t("nav.playground"), url: "/playground", icon: MessageSquareText, isActive: pathname.startsWith("/playground") },
    { title: t("nav.channels"), url: "/channels", icon: Radio, isActive: pathname.startsWith("/channels") },
    { title: language === "es" ? "Equipo" : "Team", url: "/team", icon: Users, isActive: pathname === "/team" },
    { title: t("nav.settings"), url: "/settings", icon: Settings, isActive: pathname.startsWith("/settings") },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-3 pt-3 pb-1">
        <TeamSwitcher agency={user.agency} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={user.role === "operator" ? mainNav.filter((item) => item.url === "/inbox") : mainNav} />
        {user.role === "admin" && EXTRA_NAV.length > 0 && (
          <SidebarGroup className="px-3 py-2">
            <SidebarMenu className="gap-1">
              {EXTRA_NAV.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                      isActive={active}
                      tooltip={item.label}
                      className="h-11 rounded-none px-3 font-medium tracking-[0.03em] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3 pt-2">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

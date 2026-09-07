"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bot,
  Workflow,
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
  X,
} from "lucide-react"
import { useT, useLanguage } from "@/lib/i18n"
import { BloubAvatar } from "@/components/bloub-avatar"
import { NavMain } from "@/components/nav-main"
import { Button } from "@/components/ui/button"
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
  const { setOpenMobile, state, isMobile } = useSidebar()
  const compact = state === "collapsed" && !isMobile

  const studioActive = pathname === "/studio" || pathname.startsWith("/studio/") || /^\/clients\/[^/]+\/studio$/.test(pathname)
  const mainNav: { title: string; url: string; icon: React.ComponentType<{ className?: string }>; isActive?: boolean; newWindow?: boolean }[] = [
    { title: t("nav.home"), url: "/", icon: LayoutDashboard, isActive: pathname === "/" },
    { title: t("nav.clients"), url: "/clients", icon: Building2, isActive: pathname.startsWith("/clients") && !studioActive },
    { title: "Studio", url: "/studio", icon: Workflow, isActive: studioActive, newWindow: true },
    { title: t("nav.agents"), url: "/agents", icon: Bot, isActive: pathname.startsWith("/agents") },
    { title: t("nav.inbox"), url: "/inbox", icon: Inbox, isActive: pathname.startsWith("/inbox") },
    { title: t("nav.playground"), url: "/playground", icon: MessageSquareText, isActive: pathname.startsWith("/playground") },
    { title: t("nav.channels"), url: "/channels", icon: Radio, isActive: pathname.startsWith("/channels") },
    { title: language === "es" ? "Equipo" : "Team", url: "/team", icon: Users, isActive: pathname === "/team" },
    { title: t("nav.settings"), url: "/settings", icon: Settings, isActive: pathname.startsWith("/settings") },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="cy-sidebar-header">
        <TeamSwitcher agency={user.agency} homeHref={user.role === "operator" ? "/inbox" : "/"} />
        {isMobile && <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("shell.closeMenu")} onClick={() => setOpenMobile(false)}><X /></Button>}
      </SidebarHeader>
      <SidebarContent className="cy-sidebar-content">
        <NavMain items={user.role === "operator" ? mainNav.filter((item) => item.url === "/inbox") : mainNav} />
        {user.role === "admin" && EXTRA_NAV.length > 0 && (
          <SidebarGroup className="cy-sidebar-group">
            <SidebarMenu className="gap-1.5">
              {EXTRA_NAV.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      aria-label={item.label}
                      render={<Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)} />}
                      isActive={active}
                      tooltip={item.label}
                      className="cy-sidebar-action"
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
      <SidebarFooter className="cy-sidebar-footer">
        <div className="cy-sidebar-companion" data-compact={compact || undefined}>
          <BloubAvatar size={compact ? 32 : 44} seed="voysse" animated cycleShapes cycleExpressions followPointer label={compact ? "Voxy" : undefined} />
          {!compact && <div className="min-w-0"><strong>Voxy</strong><span>{language === "es" ? "Tu compañero en Voysse" : "Your Voysse companion"}</span></div>}
        </div>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

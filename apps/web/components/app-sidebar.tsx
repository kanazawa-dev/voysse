"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
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
import { useT } from "@/lib/i18n"
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
import DitherBackground from "@/components/ui/dither-background"
import type { User } from "@/types"

// Same light dither as the dashboard cards: --sidebar is a near-white
// surface with dark --sidebar-foreground text by default (the .dark theme
// swaps both), so it uses the same white-dominant colors, not a dark base.
function SidebarGrain() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: "200px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {isVisible ? (
        <DitherBackground
          className="absolute inset-0"
          colorNum={2.5}
          waveAmplitude={0.31}
          waveSpeed={0.01}
          waveFrequency={1.8}
          waveColor={[0.09, 0.282, 0.78]}
          backgroundColor={[0.98, 0.969, 0.937]}
          enableMouseInteraction={false}
          disableAnimation
        />
      ) : null}
      <div className="absolute inset-0 bg-sidebar/80" />
    </div>
  )
}

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
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  const mainNav: { title: string; url: string; icon: React.ComponentType<{ className?: string }>; isActive?: boolean }[] = [
    { title: t("nav.home"), url: "/", icon: LayoutDashboard, isActive: pathname === "/" },
    { title: t("nav.clients"), url: "/clients", icon: Building2, isActive: pathname.startsWith("/clients") },
    { title: t("nav.agents"), url: "/agents", icon: Bot, isActive: pathname.startsWith("/agents") },
    { title: t("nav.inbox"), url: "/inbox", icon: Inbox, isActive: pathname.startsWith("/inbox") },
    { title: t("nav.playground"), url: "/playground", icon: MessageSquareText, isActive: pathname.startsWith("/playground") },
    { title: t("nav.channels"), url: "/channels", icon: Radio, isActive: pathname.startsWith("/channels") },
    { title: t("nav.settings"), url: "/settings", icon: Settings, isActive: pathname.startsWith("/settings") },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarGrain />
      <SidebarHeader className="px-3 pt-3 pb-1">
        <TeamSwitcher agency={user.agency} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav} />
        {EXTRA_NAV.length > 0 && (
          <SidebarGroup className="px-3 py-2">
            <SidebarMenu className="gap-1 rounded-2xl border border-sidebar-border/65 bg-sidebar-accent/35 p-1.5 shadow-sm">
              {EXTRA_NAV.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                      isActive={active}
                      tooltip={item.label}
                      className="h-10 rounded-xl px-3 font-semibold tracking-[0.01em] hover:bg-white hover:text-sidebar-foreground hover:shadow-sm data-active:bg-white data-active:text-sidebar-foreground data-active:shadow-sm"
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

"use client"

import Link from "next/link"
import { useT } from "@/lib/i18n"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: React.ComponentType<{ className?: string }>
    isActive?: boolean
  }[]
}) {
  const t = useT()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarGroup className="px-3 py-2">
      <SidebarGroupLabel className="mb-1 px-2 font-pixel text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
        {t("nav.section")}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              render={<Link href={item.url} onClick={() => setOpenMobile(false)} />}
              isActive={item.isActive}
              tooltip={item.title}
              className="h-10 rounded-xl px-3 font-semibold tracking-[0.01em] hover:bg-white hover:text-sidebar-foreground hover:shadow-sm data-active:bg-white data-active:text-sidebar-foreground data-active:shadow-sm"
            >
              <Icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

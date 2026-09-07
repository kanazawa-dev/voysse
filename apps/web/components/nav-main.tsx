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
    newWindow?: boolean
  }[]
}) {
  const t = useT()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarGroup className="cy-sidebar-group">
      <SidebarGroupLabel className="mb-1 px-2 font-pixel text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
        {t("nav.section")}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1.5">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              aria-label={item.title}
              render={<Link href={item.url} target={item.newWindow ? "_blank" : undefined} rel={item.newWindow ? "noopener noreferrer" : undefined} aria-current={item.isActive ? "page" : undefined} onClick={() => setOpenMobile(false)} />}
              isActive={item.isActive}
              tooltip={item.title}
              className="cy-sidebar-action"
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

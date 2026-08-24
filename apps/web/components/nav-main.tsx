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
    icon: React.ElementType
    isActive?: boolean
  }[]
}) {
  const t = useT()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("nav.section")}</SidebarGroupLabel>
      <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              render={<Link href={item.url} onClick={() => setOpenMobile(false)} />}
              isActive={item.isActive}
              tooltip={item.title}
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

"use client"

import Link from "next/link"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { OpenvoissBrand } from "@/components/openvoiss-brand"
import type { Agency } from "@/types"

export function TeamSwitcher({ agency, homeHref = "/" }: { agency: Agency; homeHref?: string }) {
  const { state, isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cy-sidebar-brand"
          aria-label={agency.name}
          render={<Link href={homeHref} onClick={() => setOpenMobile(false)} />}
          size="lg"
          tooltip={agency.name}
        >
          <OpenvoissBrand
            className="w-full"
            effect="benday"
            name={agency.name}
            showName={isMobile || state === "expanded"}
            size={32}
            state="idle"
            subtitle={agency.slug}
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

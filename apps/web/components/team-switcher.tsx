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

export function TeamSwitcher({ agency }: { agency: Agency }) {
  const { state } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-12 px-2 font-semibold hover:bg-white hover:text-sidebar-foreground hover:shadow-sm"
          render={<Link href="/" />}
          size="lg"
          tooltip={agency.name}
        >
          <OpenvoissBrand
            className="w-full"
            effect="benday"
            name={agency.name}
            showName={state === "expanded"}
            size={32}
            state="thinking"
            subtitle={agency.slug}
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

"use client"

import * as React from "react"
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Building2 } from "lucide-react"
import type { Agency } from "@/types";

export function TeamSwitcher({ agency }: { agency: Agency }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" render={<Link href="/" />}>
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            {agency.logo_url ? (
              <img src={agency.logo_url} alt={agency.name} className="size-5 object-contain" />
            ) : (
              <Building2 className="size-4" />
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{agency.name}</span>
            <span className="truncate text-xs">{agency.slug}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

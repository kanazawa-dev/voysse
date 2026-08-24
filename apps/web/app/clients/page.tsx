"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { EmptyState, PageHead, StatusBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Client } from "@/types";
import { Card } from "@/components/ui/card";

export default function ClientsPage() {
  const t = useT();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { api<Client[]>("/clients").then(setClients); }, []);
  const visible = useMemo(() => clients.filter((item) => `${item.name} ${item.industry}`.toLowerCase().includes(search.toLowerCase())), [clients, search]);

  return <div className="flex w-full flex-col gap-6">
    <PageHead eyebrow={t("clients.list.eyebrow")} title={t("clients.list.title")} description={t("clients.list.description")} action={<Button render={<Link href="/clients/new" />}><Plus size={18} /> {t("clients.list.newClient")}</Button>} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full max-w-[420px]"><Search size={18} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("clients.list.searchPlaceholder")} /></div><span className="text-sm text-muted-foreground">{t("clients.list.resultCount", { count: visible.length })}</span></div>
    {visible.length ? <Card><Table><TableHeader><TableRow><TableHead>{t("clients.list.colClient")}</TableHead><TableHead>{t("clients.list.colIndustry")}</TableHead><TableHead>{t("clients.list.colAgents")}</TableHead><TableHead>{t("clients.list.colPortal")}</TableHead><TableHead>{t("clients.list.colStatus")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{visible.map((client) => <TableRow key={client.id}><TableCell><Link href={`/clients/${client.id}`} className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{client.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0"><strong className="block">{client.name}</strong><small className="block truncate text-muted-foreground">{client.description || t("clients.list.noDescription")}</small></span></Link></TableCell><TableCell>{client.industry || t("clients.list.industryUndefined")}</TableCell><TableCell>{client.agents.length}</TableCell><TableCell><span className={client.portal_enabled ? "inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary" : "inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground"}>{client.portal_enabled ? t("clients.list.portalPublished") : t("clients.list.portalUnpublished")}</span></TableCell><TableCell><StatusBadge active={client.is_active} /></TableCell><TableCell><Link href={`/clients/${client.id}`} className="text-muted-foreground" aria-label={t("clients.list.openAria", { name: client.name })}><ArrowRight size={17} /></Link></TableCell></TableRow>)}</TableBody></Table></Card> : <EmptyState icon={<Building2 />} title={search ? t("clients.list.emptyNoMatchTitle") : t("clients.list.emptyCreateTitle")} description={search ? t("clients.list.emptyNoMatchDescription") : t("clients.list.emptyCreateDescription")} action={!search && <Button render={<Link href="/clients/new" />}><Plus size={18} /> {t("clients.list.createClient")}</Button>} />}
  </div>;
}

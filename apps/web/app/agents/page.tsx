"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { EmptyState, PageHead, StatusBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { providerLabel } from "@/lib/providers";
import type { Agent, Client } from "@/types";

export default function AgentsPage() {
  const t = useT();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { Promise.all([api<Agent[]>("/agents"), api<Client[]>("/clients")]).then(([a, c]) => { setAgents(a); setClients(c); }); }, []);
  const visible = useMemo(() => agents.filter((agent) => (!clientId || agent.client_id === clientId) && `${agent.name} ${agent.client.name} ${agent.description}`.toLowerCase().includes(search.toLowerCase())), [agents, clientId, search]);
  return <div className="flex w-full flex-col gap-6"><PageHead eyebrow={t("agents.list.eyebrow")} title={t("agents.list.title")} description={t("agents.list.description")} action={<Button render={<Link href="/agents/new" />}><Plus size={18} /> {t("agents.list.newAgent")}</Button>} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="relative w-full max-w-[420px]"><Search size={18} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("agents.list.searchPlaceholder")} /></div><div className="grid min-w-56 gap-1.5"><Label>{t("agents.list.clientLabel")}</Label><Select items={[{ value: "__all__", label: t("agents.list.allClients") }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} value={clientId || "__all__"} onValueChange={(value) => setClientId(!value || value === "__all__" ? "" : value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">{t("agents.list.allClients")}</SelectItem>{clients.map((client) => <SelectItem value={client.id} key={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div></div>
    {visible.length ? <div className="overflow-hidden rounded-xl border bg-card shadow-sm"><Table><TableHeader><TableRow><TableHead>{t("agents.list.thAgent")}</TableHead><TableHead>{t("agents.list.thClient")}</TableHead><TableHead>{t("agents.list.thModel")}</TableHead><TableHead>{t("agents.list.thStatus")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{visible.map((agent) => <TableRow key={agent.id}><TableCell><Link href={`/agents/${agent.id}`} className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot size={18} /></span><span><strong>{agent.name}</strong><small>{agent.description || t("agents.list.noDescription")}</small></span></Link></TableCell><TableCell><Link href={`/clients/${agent.client_id}`} className="font-medium hover:text-primary hover:underline">{agent.client.name}</Link></TableCell><TableCell>{agent.model ? <span className="flex items-center gap-3"><strong>{agent.model}</strong><small>{providerLabel(agent.provider)}</small></span> : <span className="text-muted-foreground">{t("agents.list.notConfigured")}</span>}</TableCell><TableCell><StatusBadge active={agent.is_active} /></TableCell><TableCell><Link href={`/agents/${agent.id}`} className="text-muted-foreground"><ArrowRight size={17} /></Link></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState icon={<Bot />} title={t("agents.list.emptyTitle")} description={clients.length ? t("agents.list.emptyWithClients") : t("agents.list.emptyNoClients")} action={<Button render={<Link href={clients.length ? "/agents/new" : "/clients/new"} />}>{t("agents.list.continue")}</Button>} />}
  </div>;
}

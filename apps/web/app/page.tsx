"use client";

import Link from "next/link";
import { BloubAvatar } from "@/components/bloub-avatar";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, Building2, Cpu, MessagesSquare, MessageSquareText, Radio, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { PageHead, StatusBadge } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Agent, AgentSummary, Conversation } from "@/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number";
import { useReducedMotion } from "motion/react";

type Dashboard = { clients: number; active_clients: number; agents: number; active_agents: number; conversations: number; channels: number; connected_channels: number; recent_agents: AgentSummary[] };
type DailyPoint = { date: string; count: number };
type TopAgent = { id: string; name: string; conversations: number };
type ModelUsage = { model: string; input_tokens: number; output_tokens: number };
type Metrics = { messages: number; human_conversations: number; by_channel: Record<string, number>; daily_conversations: DailyPoint[]; top_agents: TopAgent[]; tokens_in: number; tokens_out: number; usage_by_model: ModelUsage[] };

function AnimatedMetric({ value }: { value: number | undefined }) {
  const reducedMotion = useReducedMotion();
  if (value === undefined) return <>—</>;
  return <><CountingNumber number={value} initiallyStable={Boolean(reducedMotion)} aria-hidden="true" /><span className="sr-only">{value.toLocaleString()}</span></>;
}

export default function HomePage() {
  const t = useT();
  const [data, setData] = useState<Dashboard | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [range, setRange] = useState(14);
  useEffect(() => { Promise.all([api<Dashboard>("/dashboard"), api<Agent[]>("/agents"), api<Conversation[]>("/conversations")]).then(([d, a, x]) => { setData(d); setAgents(a); setConversations(x); }); }, []);
  useEffect(() => { api<Metrics>(`/dashboard/metrics?days=${range}`).then(setMetrics).catch(() => {}); }, [range]);

  const maxDaily = Math.max(1, ...(metrics?.daily_conversations.map((p) => p.count) ?? [0]));
  const trend = metrics?.daily_conversations ?? [];
  const usage = metrics?.usage_by_model ?? [];
  const maxUsage = Math.max(1, ...usage.map((u) => u.input_tokens + u.output_tokens));

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHead eyebrow={t("home.head.eyebrow")} title={t("home.head.title")} description={t("home.head.description")} action={<Select value={String(range)} onValueChange={(value) => value && setRange(Number(value))}><SelectTrigger><SelectValue>{t("home.range.days", { count: range })}</SelectValue></SelectTrigger><SelectContent>{[7, 14, 30, 90].map((days) => <SelectItem key={days} value={String(days)}>{t("home.range.days", { count: days })}</SelectItem>)}</SelectContent></Select>} />
      <Card className="cy-onboarding relative isolate overflow-hidden p-5 [&_ol]:grid [&_ol]:gap-3 md:[&_ol]:grid-cols-3 [&_li]:flex [&_li]:gap-3 [&_li]:rounded-lg [&_li]:bg-muted/50 [&_li]:p-3 [&_li>span]:flex [&_li>span]:size-7 [&_li>span]:shrink-0 [&_li>span]:items-center [&_li>span]:justify-center [&_li>span]:rounded-full [&_li>span]:bg-primary [&_li>span]:text-xs [&_li>span]:font-semibold [&_li>span]:text-primary-foreground [&_small]:block [&_small]:text-muted-foreground">
        <div aria-hidden="true" className="cy-workspace-backdrop" />
        <div className="relative z-10 mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-pixel">{t("home.nextSteps.title")}</h3><p>{t("home.nextSteps.subtitle")}</p></div></div>
        <ol className="relative z-10"><li className={data?.clients ? "opacity-70" : ""}><span>{data?.clients ? "✓" : "1"}</span><div><strong>{t("home.nextSteps.step1Title")}</strong><small>{t("home.nextSteps.step1Desc")}</small></div></li><li className={data?.agents ? "opacity-70" : ""}><span>{data?.agents ? "✓" : "2"}</span><div><strong>{t("home.nextSteps.step2Title")}</strong><small>{t("home.nextSteps.step2Desc")}</small></div></li><li><span>3</span><div><strong>{t("home.nextSteps.step3Title")}</strong><small>{t("home.nextSteps.step3Desc")}</small></div></li></ol>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex gap-4 p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-4xl [&_strong]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary "><Building2 size={20} /></span><div><small>{t("home.metrics.clients")}</small><strong><AnimatedMetric value={data?.clients} /></strong><p>{t("home.metrics.clientsActive", { count: data?.active_clients ?? 0 })}</p></div></Card>
        <Card className="flex gap-4 p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-4xl [&_strong]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary "><Bot size={20} /></span><div><small>{t("home.metrics.agents")}</small><strong><AnimatedMetric value={agents.length || data?.agents} /></strong><p>{t("home.metrics.agentsActive", { count: agents.filter((item) => item.is_active).length })}</p></div></Card>
        <Card className="flex gap-4 p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-4xl [&_strong]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary "><MessageSquareText size={20} /></span><div><small>{t("home.metrics.conversations")}</small><strong><AnimatedMetric value={conversations.length} /></strong><p>{t("home.metrics.conversationsCaption")}</p></div></Card>
        <Card className="flex gap-4 p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-4xl [&_strong]:font-semibold [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary "><Radio size={20} /></span><div><small>{t("home.metrics.channels")}</small><strong><AnimatedMetric value={data?.channels} /></strong><p>{t("home.metrics.channelsConnected", { count: data?.connected_channels ?? 0 })}</p></div></Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-6 text-card-foreground min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("home.activity.title")}</h3><p>{t("home.activity.subtitle", { count: range })}</p></div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1"><span><MessagesSquare size={14} /> {metrics?.messages ?? 0} · {t("home.activity.messages")}</span><span><UserRound size={14} /> {metrics?.human_conversations ?? 0} · {t("home.activity.humanHandled")}</span></div>
          </div>
          {trend.some((p) => p.count > 0) ? <>
            <div className="flex h-40 items-end gap-1 rounded-lg bg-muted/40 p-3">{trend.map((p) => <div key={p.date} className="flex h-full min-w-0 flex-1 items-end" title={`${p.date}: ${p.count}`}><div className="w-full min-h-0.5 rounded-sm bg-primary" style={{ height: `${Math.round((p.count / maxDaily) * 100)}%` }} /></div>)}</div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{new Date(`${trend[0].date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" })}</span><span>{new Date(`${trend[trend.length - 1].date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" })}</span></div>
          </> : <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><MessagesSquare size={22} /><div><strong>{t("home.activity.empty")}</strong></div></div>}
        </div>
        <div className="rounded-sm border border-border bg-card p-6 text-card-foreground">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("home.topAgents.title")}</h3><p>{t("home.topAgents.subtitle")}</p></div></div>
          {metrics?.top_agents.length ? <div className="divide-y">{metrics.top_agents.map((agent, index) => <Link href={`/agents/${agent.id}`} key={agent.id} className="flex items-center gap-3 py-3 text-sm transition-colors hover:text-primary"><span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BloubAvatar size={32} animated={false} /></span><strong>{agent.name}</strong><span className="ml-auto text-xs text-muted-foreground">{t("home.topAgents.conversations", { count: agent.conversations })}</span></Link>)}</div> : <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><BloubAvatar size={42} animated={false} /><div><strong>{t("home.topAgents.empty")}</strong></div></div>}
        </div>
      </section>
      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("home.usage.title")}</h3><p>{t("home.usage.subtitle")}</p></div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1"><span>↓ {(metrics?.tokens_in ?? 0).toLocaleString("es")} {t("home.usage.in")}</span><span>↑ {(metrics?.tokens_out ?? 0).toLocaleString("es")} {t("home.usage.out")}</span></div>
        </div>
        {usage.length ? <div className="space-y-3">{usage.map((item) => { const total = item.input_tokens + item.output_tokens; return <div className="grid items-center gap-3 text-sm sm:grid-cols-[minmax(8rem,1fr)_3fr_auto]" key={item.model}><strong>{item.model}</strong><Progress value={Math.round((total / maxUsage) * 100)} /><span className="text-xs tabular-nums text-muted-foreground">{total.toLocaleString("es")} tok</span></div>; })}</div> : <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><Cpu size={22} /><div><strong>{t("home.usage.empty")}</strong></div></div>}
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("home.recentAgents.title")}</h3><p>{t("home.recentAgents.subtitle")}</p></div><Link href="/agents" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{t("home.recentAgents.viewAll")} <ArrowRight size={15} /></Link></div>
        {agents.length ? <div className="divide-y">{agents.slice(0, 5).map((agent) => <Link href={`/agents/${agent.id}`} key={agent.id} className="flex items-center gap-3 py-3 transition-colors hover:text-primary [&>div]:min-w-0 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:text-muted-foreground"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BloubAvatar size={36} animated={false} /></span><div><strong>{agent.name}</strong><small>{agent.client.name} · {agent.description || t("common.noDescription")}</small></div><StatusBadge active={agent.is_active} /><ArrowRight size={16} /></Link>)}</div> : <div className="flex min-h-28 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><BloubAvatar size={56} mood="listening" /><div><strong className="block">{t("home.recentAgents.emptyTitle")}</strong><span className="block">{t("home.recentAgents.emptyDesc")}</span></div></div>}
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  FileText,
  Github,
  Globe,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MessageSquareText,
  Radio,
  Server,
  Settings,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import Grainient from "@/components/grainient";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TabId = "agents" | "knowledge" | "tools" | "channels";

const TAB_IDS: TabId[] = ["agents", "knowledge", "tools", "channels"];
const TAB_ICONS: Record<TabId, typeof MessageSquareText> = {
  agents: MessageSquareText,
  knowledge: BookOpen,
  tools: Wrench,
  channels: MessageCircle,
};

const FAQ_IDS = [1, 2, 3, 4, 5] as const;

const COMPARE_ROW_IDS = [
  "agentBuilder",
  "knowledgeRag",
  "webchat",
  "whatsapp",
  "clientAccounts",
  "whitelabel",
  "customDomain",
  "byoKeys",
  "selfHosting",
  "basicRoles",
  "autoInstall",
  "autoUpdates",
  "backups",
  "observability",
  "sso",
  "advancedAudit",
  "rbac",
  "supportSla",
  "highAvailability",
  "opsOwner",
] as const;

const containerClass = "mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-14";
const sectionClass = "py-14 md:py-20 lg:py-24";

type NavRow = { href: string; icon: typeof MessageCircle; title: string; desc: string };

function GrainLayer({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden="true">
      <Grainient className="absolute inset-0" grainAnimated />
      <div className="absolute inset-0 bg-background/40" />
    </div>
  );
}

function Eyebrow({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase", inverse ? "text-primary-foreground" : "text-primary-foreground")}>
      <span className={cn("size-1.5 rounded-full", inverse ? "bg-primary-foreground" : "bg-primary")} />
      {children}
    </span>
  );
}

export default function LandingPage() {
  const t = useT();
  // Empty by default: relative "/login" resolves same-origin, matching this
  // repo's NEXT_PUBLIC_API_URL pattern (apps/web/Dockerfile). Set this when
  // the dashboard is deployed on a different origin than the marketing site
  // (e.g. https://app.openvoiss.com).
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const [activeTab, setActiveTab] = useState<TabId>("agents");
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set());

  const resourceLinks: NavRow[] = [
    { href: "#channels", icon: MessageCircle, title: t("welcome.nav.channels"), desc: t("welcome.nav.resourcesMenu.channelsDesc") },
    { href: "#open-source", icon: Server, title: t("welcome.nav.selfhost"), desc: t("welcome.nav.resourcesMenu.selfhostDesc") },
    { href: "#faq", icon: HelpCircle, title: t("welcome.nav.faq"), desc: t("welcome.nav.resourcesMenu.faqDesc") },
    { href: "https://openvoiss.com/docs", icon: FileText, title: t("welcome.nav.docs"), desc: t("welcome.nav.resourcesMenu.docsDesc") },
  ];
  const allLinks: NavRow[] = [
    { href: "#features", icon: Sparkles, title: t("welcome.nav.features"), desc: t("welcome.nav.resourcesMenu.featuresDesc") },
    { href: "#pricing", icon: Wallet, title: t("welcome.nav.pricing"), desc: t("welcome.nav.resourcesMenu.pricingDesc") },
    ...resourceLinks,
  ];

  function menuItems(rows: NavRow[]) {
    return rows.map(({ href, icon: Icon, title, desc }) => (
      <DropdownMenuItem key={href} className="items-start py-2.5" render={<a href={href} />}>
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-foreground/10">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{desc}</span>
        </span>
      </DropdownMenuItem>
    ));
  }

  const ctaClass = "h-11 rounded-2xl px-5 text-sm sm:h-12 sm:px-6 sm:text-base";

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <nav className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
        <div className={cn(containerClass, "flex h-[74px] items-center gap-2 sm:gap-4")}>
          <a href="#top" aria-label="Openvoiss" className="shrink-0">
            <OpenvoissBrand effect="benday" showName size={36} state="thinking" />
          </a>

          <div className="hidden flex-1 items-center justify-center gap-7 lg:flex">
            <a className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground" href="#features">{t("welcome.nav.features")}</a>
            <a className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground" href="#pricing">{t("welcome.nav.pricing")}</a>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" />}>
                {t("welcome.nav.resources")} <ChevronDown className="size-3.5 transition-transform group-aria-expanded/button:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" sideOffset={12} className="w-80">
                {menuItems(resourceLinks)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="ml-auto lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" size="icon" variant="ghost" aria-label={t("welcome.nav.resources")} />}>
                <Menu className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={12} className="w-[min(20rem,calc(100vw-2rem))]">
                {menuItems(allLinks)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <Button className="hidden sm:inline-flex" variant="outline" size="sm" render={<a href="https://github.com/kanazawa-dev/openvoiss" />}>
              <Github className="size-4" /> <span className="hidden xl:inline">GitHub</span>
            </Button>
            <Button className="hidden min-[370px]:inline-flex" size="sm" render={<a href={`${appUrl}/login`} />}>
              {t("welcome.nav.getStarted")}
            </Button>
          </div>
        </div>
      </nav>

      <main id="top">
        <section className="relative overflow-hidden py-16 sm:py-20 lg:py-28">
          <div className="absolute -top-40 -right-32 size-[28rem] rounded-full bg-primary/35 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-36 -left-24 size-80 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className={cn(containerClass, "relative flex flex-col items-center text-center")}>
            <Eyebrow>{t("welcome.hero.eyebrow")}</Eyebrow>
            <h1 className="mt-5 max-w-4xl font-heading text-5xl leading-[0.92] font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl">
              {t("welcome.hero.titleLine1")}<br />{t("welcome.hero.titleLine2")}
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{t("welcome.hero.sub")}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button className={ctaClass} render={<a href={`${appUrl}/login`} />}>
                {t("welcome.nav.getStarted")} <ArrowRight className="size-4" />
              </Button>
              <Button className={ctaClass} variant="secondary" render={<a href="https://openvoiss.com/docs/getting-started" />}>
                {t("welcome.hero.readDocs")}
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t("welcome.hero.note")}</p>

            <div className="mt-12 w-full lg:mt-16">
              <Card className="mx-auto w-full max-w-[960px] gap-0 overflow-hidden py-0 text-left shadow-2xl shadow-foreground/10">
                <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-3" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-foreground/15" /><span className="size-2.5 rounded-full bg-foreground/15" /><span className="size-2.5 rounded-full bg-foreground/15" />
                  <span className="mx-auto rounded-2xl bg-background/80 px-4 py-1 font-mono text-[11px] text-muted-foreground">app.openvoiss.com</span>
                </div>
                <div className="grid min-h-[340px] md:grid-cols-[200px_1fr]">
                  <div className="flex flex-row flex-wrap gap-1 bg-foreground p-3 text-background md:flex-col md:p-4">
                    <div className="flex min-h-9 items-center px-1 pb-2 md:pb-3"><OpenvoissBrand decorative size={20} /></div>
                    <span className="flex items-center gap-2 rounded-xl bg-primary/20 px-2.5 py-2 text-xs text-background"><LayoutDashboard className="size-3.5" /> {t("nav.home")}</span>
                    <span className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-background/65"><Building2 className="size-3.5" /> {t("nav.clients")}</span>
                    <span className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-background/65"><Bot className="size-3.5" /> {t("nav.agents")}</span>
                    <span className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-background/65"><Inbox className="size-3.5" /> {t("nav.inbox")}</span>
                    <span className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-background/65"><MessageSquareText className="size-3.5" /> {t("nav.playground")}</span>
                    <span className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-background/65"><Radio className="size-3.5" /> {t("nav.channels")}</span>
                    <span className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-background/65"><Settings className="size-3.5" /> {t("nav.settings")}</span>
                  </div>
                  <div className="p-5 sm:p-6">
                    <h3 className="font-heading text-lg font-medium">{t("welcome.hero.dashboard.title")}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{t("welcome.hero.dashboard.subtitle")}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Card size="sm" className="gap-1 rounded-2xl bg-muted/40 py-3 shadow-none"><CardContent><span className="block text-[10px] tracking-wide text-muted-foreground uppercase">{t("welcome.hero.dashboard.statAgentsLabel")}</span><strong className="mt-1 block text-lg">{t("welcome.hero.dashboard.statAgentsValue")}</strong></CardContent></Card>
                      <Card size="sm" className="gap-1 rounded-2xl bg-muted/40 py-3 shadow-none"><CardContent><span className="block text-[10px] tracking-wide text-muted-foreground uppercase">{t("welcome.hero.dashboard.statConvLabel")}</span><strong className="mt-1 block text-lg">{t("welcome.hero.dashboard.statConvValue")}</strong></CardContent></Card>
                      <Card size="sm" className="gap-1 rounded-2xl bg-muted/40 py-3 shadow-none"><CardContent><span className="block text-[10px] tracking-wide text-muted-foreground uppercase">{t("welcome.hero.dashboard.statResponseLabel")}</span><strong className="mt-1 block text-lg">{t("welcome.hero.dashboard.statResponseValue")}</strong></CardContent></Card>
                    </div>
                    <div className="mt-5 overflow-hidden rounded-2xl border">
                      <Table>
                        <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>{t("welcome.hero.dashboard.colClient")}</TableHead><TableHead>{t("welcome.hero.dashboard.colAgent")}</TableHead><TableHead /></TableRow></TableHeader>
                        <TableBody>
                          {([1, 2, 3] as const).map((row) => (
                            <TableRow key={row}>
                              <TableCell><span className="flex items-center gap-2 font-medium"><span className="grid size-6 place-items-center rounded-full bg-primary/30 text-[10px] text-primary-foreground">{t(`welcome.hero.dashboard.row${row}Client`).slice(0, 1)}</span>{t(`welcome.hero.dashboard.row${row}Client`)}</span></TableCell>
                              <TableCell>{t(`welcome.hero.dashboard.row${row}Agent`)}</TableCell>
                              <TableCell className="text-right"><Badge variant={row === 2 ? "secondary" : "default"}>{t(`welcome.hero.dashboard.row${row}Status`)}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="overflow-hidden border-y py-8">
          <div className="relative w-full overflow-hidden" aria-hidden="true">
            <div className="marketing-marquee-track flex w-max items-center gap-7 [animation:marketing-marquee_24s_linear_infinite]">
              {[0, 1].map((rep) => (
                <span key={rep} className="contents">
                  <span className="font-heading text-xl font-medium whitespace-nowrap sm:text-2xl">{t("welcome.trust.mit")}</span><span className="text-primary">&bull;</span>
                  <span className="font-heading text-xl font-medium whitespace-nowrap sm:text-2xl">{t("welcome.trust.selfhost")}</span><span className="text-primary">&bull;</span>
                  <span className="font-heading text-xl font-medium whitespace-nowrap sm:text-2xl">{t("welcome.trust.compatible")}</span><span className="text-primary">&bull;</span>
                  <span className="font-heading text-xl font-medium whitespace-nowrap sm:text-2xl">{t("welcome.trust.isolated")}</span><span className="text-primary">&bull;</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionClass} id="features">
          <div className={containerClass}>
            <div className="mb-10 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.features.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.features.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.features.sub")}</p>
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
              <TabsList className="grid h-auto w-full grid-cols-2 justify-start gap-2 rounded-none bg-transparent p-1 lg:flex lg:flex-col lg:items-stretch">
                {TAB_IDS.map((id) => {
                  const Icon = TAB_ICONS[id];
                  return (
                    <TabsTrigger key={id} value={id} className="h-auto w-full min-w-0 flex-none justify-start gap-3 rounded-2xl p-3 text-left data-active:bg-foreground data-active:text-background sm:p-4 lg:w-full">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary-foreground"><Icon className="size-4" /></span>
                      <span><strong className="block font-medium">{t(`welcome.tabs.${id}.label`)}</strong><span className="mt-0.5 block text-xs opacity-70">{t(`welcome.tabs.${id}.sub`)}</span></span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <TabsContent value={activeTab} className="min-h-full">
                <Card className="relative isolate h-full min-h-[360px] justify-center border-0 bg-primary text-primary-foreground ring-primary/20">
                  <GrainLayer />
                  <CardHeader className="relative z-10"><CardTitle className="text-2xl sm:text-3xl">{t(`welcome.panels.${activeTab}.title`)}</CardTitle></CardHeader>
                  <CardContent className="relative z-10 space-y-6">
                    <p className="max-w-xl text-base leading-7 text-primary-foreground/80">{t(`welcome.panels.${activeTab}.body`)}</p>
                    <ul className="space-y-3">
                      <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" /> {t(`welcome.panels.${activeTab}.p1`)}</li>
                      <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" /> {t(`welcome.panels.${activeTab}.p2`)}</li>
                      <li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" /> {t(`welcome.panels.${activeTab}.p3`)}</li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24" id="channels">
          <div className={containerClass}>
            <div className="mb-10 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.ops.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.ops.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.ops.sub")}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <Card className="transition-transform duration-200 hover:-translate-y-1">
                <CardHeader><span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary/20 text-primary-foreground"><Inbox className="size-5" /></span><CardTitle className="text-lg">{t("welcome.ops.inbox.title")}</CardTitle></CardHeader>
                <CardContent><p className="leading-6 text-muted-foreground">{t("welcome.ops.inbox.body")}</p></CardContent>
              </Card>
              <Card className="transition-transform duration-200 hover:-translate-y-1">
                <CardHeader><span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary/20 text-primary-foreground"><Globe className="size-5" /></span><CardTitle className="text-lg">{t("welcome.ops.portals.title")}</CardTitle></CardHeader>
                <CardContent><p className="leading-6 text-muted-foreground">{t("welcome.ops.portals.body")}</p></CardContent>
              </Card>
              <Card className="transition-transform duration-200 hover:-translate-y-1">
                <CardHeader><span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary/20 text-primary-foreground"><Building2 className="size-5" /></span><CardTitle className="text-lg">{t("welcome.ops.whitelabel.title")}</CardTitle></CardHeader>
                <CardContent><p className="leading-6 text-muted-foreground">{t("welcome.ops.whitelabel.body")}</p></CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24" id="open-source">
          <div className={containerClass}>
            <Card className="relative isolate grid gap-10 border-0 bg-primary px-2 py-8 text-primary-foreground ring-primary/20 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10 lg:py-12">
              <GrainLayer />
              <div className="relative z-10 px-5">
                <Eyebrow inverse>{t("welcome.stack.eyebrow")}</Eyebrow>
                <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.stack.title")}</h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-primary-foreground/80">{t("welcome.stack.body")}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button className={ctaClass} render={<a href="https://openvoiss.com/docs/self-hosting" />}>{t("welcome.stack.guideBtn")}</Button>
                  <Button className={ctaClass} variant="secondary" render={<a href="https://openvoiss.com/docs/architecture" />}>{t("welcome.stack.archBtn")}</Button>
                </div>
              </div>
              <div className="relative z-10 space-y-5 px-5">
                {(["step1", "step2", "step3"] as const).map((step, index) => (
                  <div className="flex gap-4" key={step}>
                    <span className="w-11 shrink-0 font-mono text-2xl font-medium">{String(index + 1).padStart(2, "0")}</span>
                    <div><strong className="block font-heading font-medium">{t(`welcome.stack.${step}.title`)}</strong><span className="mt-1 block text-sm text-primary-foreground/75">{t(`welcome.stack.${step}.body`)}</span></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24" id="pricing">
          <div className={containerClass}>
            <div className="mb-10 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.plans.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.plans.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.plans.sub")}</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <CardHeader><Badge className="mb-2" variant="default">{t("welcome.plans.selfhost.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.selfhost.title")}</CardTitle><div className="font-heading text-3xl font-semibold text-primary-foreground">{t("welcome.plans.selfhost.price")}</div></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5"><p className="leading-6 text-muted-foreground">{t("welcome.plans.selfhost.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.selfhost.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.selfhost.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.selfhost.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.selfhost.p4")}</li></ul></CardContent>
                <CardFooter><Button className={ctaClass} render={<a href={`${appUrl}/login`} />}>{t("welcome.plans.selfhost.cta")}</Button></CardFooter>
              </Card>

              <Card className="relative isolate border-0 bg-primary text-primary-foreground ring-primary/20">
                <GrainLayer />
                <CardHeader className="relative z-10"><Badge className="mb-2 bg-primary-foreground/10 text-primary-foreground" variant="secondary">{t("welcome.plans.cloud.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.cloud.title")}</CardTitle><div><div className="font-heading text-3xl font-semibold">{t("welcome.plans.cloud.price")}</div><div className="mt-1 text-sm text-primary-foreground/75">{t("welcome.plans.cloud.included")}</div></div></CardHeader>
                <CardContent className="relative z-10 flex flex-1 flex-col gap-5"><p className="leading-6 text-primary-foreground/80">{t("welcome.plans.cloud.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p4")}</li></ul></CardContent>
                <CardFooter className="relative z-10"><Button className={ctaClass} variant="secondary" render={<a href="https://github.com/kanazawa-dev/openvoiss/discussions" />}>{t("welcome.plans.cloud.cta")}</Button></CardFooter>
              </Card>

              <Card>
                <CardHeader><Badge className="mb-2" variant="secondary">{t("welcome.plans.enterprise.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.enterprise.title")}</CardTitle><div><div className="font-heading text-3xl font-semibold text-primary-foreground">{t("welcome.plans.enterprise.price")}</div><div className="mt-1 text-sm text-muted-foreground">{t("welcome.plans.enterprise.included")}</div></div></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5"><p className="leading-6 text-muted-foreground">{t("welcome.plans.enterprise.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p4")}</li></ul></CardContent>
                <CardFooter><Button className={ctaClass} variant="secondary" render={<a href="mailto:enterprise@openvoiss.com" />}>{t("welcome.plans.enterprise.cta")}</Button></CardFooter>
              </Card>
            </div>

            <div className="mt-14 mb-5 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.compare.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.compare.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.compare.sub")}</p>
            </div>
            <Card className="gap-0 overflow-hidden py-0">
              <Table className="min-w-[720px]">
                <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50"><TableHead>{t("welcome.compare.colFeature")}</TableHead><TableHead>{t("welcome.plans.selfhost.title")}</TableHead><TableHead className="bg-primary text-primary-foreground">{t("welcome.plans.cloud.title")}</TableHead><TableHead>{t("welcome.plans.enterprise.title")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {COMPARE_ROW_IDS.map((id) => (
                    <TableRow key={id}>
                      <TableCell className="min-w-52 font-medium whitespace-normal">{t(`welcome.compare.rows.${id}.label`)}</TableCell>
                      {(["community", "cloud", "enterprise"] as const).map((tier) => {
                        const value = t(`welcome.compare.rows.${id}.${tier}`);
                        return <TableCell key={tier} className={cn("whitespace-normal", tier === "cloud" && "bg-primary/10 font-medium", value === "—" && "text-muted-foreground")}>{value}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </section>

        <section className={sectionClass} id="faq">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
            <div className="mb-9 space-y-3 text-center">
              <Eyebrow>{t("welcome.faq.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.faq.title")}</h2>
            </div>
            <Accordion
              multiple
              value={[...openFaq].map(String)}
              onValueChange={(values) => setOpenFaq(new Set(values.map(Number)))}
            >
              {FAQ_IDS.map((id) => (
                <AccordionItem value={String(id)} key={id}>
                  <AccordionTrigger className="py-5 text-base">{t(`welcome.faq.q${id}` as "welcome.faq.q1")}</AccordionTrigger>
                  <AccordionContent className="max-w-2xl leading-7 text-muted-foreground">{t(`welcome.faq.a${id}` as "welcome.faq.a1")}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24">
          <div className={containerClass}>
            <Card className="relative isolate items-center border-0 bg-primary px-4 py-14 text-center text-primary-foreground ring-primary/20 sm:px-10 sm:py-20">
              <GrainLayer />
              <CardHeader className="relative z-10 w-full justify-items-center"><CardTitle className="w-full max-w-3xl text-3xl sm:text-5xl">{t("welcome.cta.title")}</CardTitle></CardHeader>
              <CardContent className="relative z-10"><p className="max-w-lg text-base leading-7 text-primary-foreground/80">{t("welcome.cta.body")}</p></CardContent>
              <CardFooter className="relative z-10 flex-wrap justify-center gap-3">
                <Button className={ctaClass} render={<a href={`${appUrl}/login`} />}>{t("welcome.nav.getStarted")}</Button>
                <Button className={ctaClass} variant="secondary" render={<a href="https://github.com/kanazawa-dev/openvoiss" />}>{t("welcome.cta.star")}</Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-10 sm:py-12">
        <div className={containerClass}>
          <div className="flex flex-wrap justify-between gap-10 pb-10">
            <div>
              <OpenvoissBrand effect="benday" showName size={36} state="thinking" />
              <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">{t("welcome.footer.blurb")}</p>
            </div>
            <div className="flex flex-wrap gap-10 sm:gap-14">
              <div><strong className="mb-3 block text-xs tracking-wider text-muted-foreground uppercase">{t("welcome.footer.colProduct")}</strong><div className="space-y-2 text-sm"><a className="block hover:text-primary-foreground" href="#features">{t("welcome.nav.features")}</a><a className="block hover:text-primary-foreground" href="#channels">{t("welcome.ops.eyebrow")}</a><a className="block hover:text-primary-foreground" href="#open-source">{t("welcome.nav.selfhost")}</a><a className="block hover:text-primary-foreground" href="#pricing">{t("welcome.nav.pricing")}</a></div></div>
              <div><strong className="mb-3 block text-xs tracking-wider text-muted-foreground uppercase">{t("welcome.footer.colResources")}</strong><div className="space-y-2 text-sm"><a className="block hover:text-primary-foreground" href="https://openvoiss.com/docs">{t("welcome.footer.docs")}</a><a className="block hover:text-primary-foreground" href="https://openvoiss.com/docs/getting-started">{t("welcome.footer.quickstart")}</a><a className="block hover:text-primary-foreground" href="https://github.com/kanazawa-dev/openvoiss/discussions">{t("welcome.footer.discussions")}</a></div></div>
              <div><strong className="mb-3 block text-xs tracking-wider text-muted-foreground uppercase">{t("welcome.footer.colProject")}</strong><div className="space-y-2 text-sm"><a className="block hover:text-primary-foreground" href="https://github.com/kanazawa-dev/openvoiss">GitHub</a><a className="block hover:text-primary-foreground" href="https://openvoiss.com/docs/contributing">{t("welcome.footer.contributing")}</a></div></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground"><span>{t("welcome.footer.license")}</span><span>{t("welcome.footer.tagline")}</span></div>
        </div>
      </footer>
    </div>
  );
}

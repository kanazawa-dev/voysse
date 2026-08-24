"use client";

import { useEffect, useState } from "react";
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
  MousePointer2,
  Radio,
  Server,
  Settings,
  Sparkles,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import Grainient from "@/components/grainient";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { Safari } from "@/components/ui/safari";
import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/ui/terminal";
import { BorderBeam } from "@/components/ui/border-beam";
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
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { cn } from "@/lib/utils";

type TabId = "agents" | "knowledge" | "tools" | "channels";

const TAB_IDS: TabId[] = ["agents", "knowledge", "tools", "channels"];
const BENTO_SPAN: Record<TabId, string> = {
  agents: "col-span-1 sm:col-span-2 sm:row-span-2",
  knowledge: "col-span-1",
  tools: "col-span-1",
  channels: "col-span-1 sm:col-span-3",
};
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
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set());
  const [heroActiveNav, setHeroActiveNav] = useState<"home" | "playground">("home");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let revertTimer: ReturnType<typeof setTimeout>;
    const click = () => {
      setHeroActiveNav("playground");
      revertTimer = setTimeout(() => setHeroActiveNav("home"), 6480);
    };
    const firstClick = setTimeout(click, 2070);
    const loop = setInterval(click, 9000);
    return () => {
      clearTimeout(firstClick);
      clearInterval(loop);
      clearTimeout(revertTimer);
    };
  }, []);

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
            <Button className="hidden sm:inline-flex" variant="outline" size="sm" render={<a href="https://github.com/kanazawa-dev/openvoiss" />} nativeButton={false}>
              <Github className="size-4" /> <span className="hidden xl:inline">GitHub</span>
            </Button>
            <Button className="hidden min-[370px]:inline-flex" size="sm" render={<a href={`${appUrl}/login`} />} nativeButton={false}>
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
              <Button className={ctaClass} render={<a href={`${appUrl}/login`} />} nativeButton={false}>
                {t("welcome.nav.getStarted")} <ArrowRight className="size-4" />
              </Button>
              <Button className={ctaClass} variant="secondary" render={<a href="https://openvoiss.com/docs/getting-started" />} nativeButton={false}>
                {t("welcome.hero.readDocs")}
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t("welcome.hero.note")}</p>

            <div className="relative mt-12 w-full [perspective:1400px] lg:mt-16">
              <div
                className="absolute inset-x-6 top-6 -z-10 h-[560px] rounded-[3rem] bg-primary/30 blur-3xl sm:inset-x-16"
                aria-hidden="true"
              />
              <Safari
                url="app.openvoiss.com"
                mode="simple"
                className={cn(
                  "group mx-auto w-full max-w-[1060px] origin-top text-left",
                  "drop-shadow-2xl",
                  "transition-transform duration-700 ease-out will-change-transform",
                  "[transform:rotateX(14deg)_scale(0.94)] hover:[transform:rotateX(2deg)_scale(1)]",
                  "[mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)]",
                  "[-webkit-mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)]",
                )}
              >
                <div className="relative grid h-full md:grid-cols-[212px_1fr]">
                  <div className="flex flex-row flex-wrap gap-1 border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex-col md:border-r md:p-4">
                    <div className="flex min-h-9 items-center px-1 pb-2 md:pb-3"><OpenvoissBrand decorative size={20} /></div>
                    {(
                      [
                        { key: "home" as const, icon: LayoutDashboard, label: t("nav.home") },
                        { key: "clients" as const, icon: Building2, label: t("nav.clients") },
                        { key: "agents" as const, icon: Bot, label: t("nav.agents") },
                        { key: "inbox" as const, icon: Inbox, label: t("nav.inbox") },
                        { key: "playground" as const, icon: MessageSquareText, label: t("nav.playground") },
                        { key: "channels" as const, icon: Radio, label: t("nav.channels") },
                        { key: "settings" as const, icon: Settings, label: t("nav.settings") },
                      ]
                    ).map((item) => (
                      <span
                        key={item.key}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                          item.key === heroActiveNav
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70",
                        )}
                      >
                        <item.icon className="size-4" /> {item.label}
                      </span>
                    ))}
                  </div>
                  <div className="relative h-full">
                    <div
                      className={cn(
                        "absolute inset-0 p-5 transition-opacity duration-500 sm:p-8",
                        heroActiveNav === "playground" ? "pointer-events-none opacity-0" : "opacity-100",
                      )}
                    >
                      <h3 className="font-heading text-lg font-medium">{t("welcome.hero.dashboard.title")}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{t("welcome.hero.dashboard.subtitle")}</p>
                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <Card size="sm" className="gap-1 rounded-2xl bg-muted/40 py-3 shadow-none"><CardContent><span className="block text-[10px] tracking-wide text-muted-foreground uppercase">{t("welcome.hero.dashboard.statAgentsLabel")}</span><strong className="mt-1 block text-lg">{t("welcome.hero.dashboard.statAgentsValue")}</strong></CardContent></Card>
                        <Card size="sm" className="gap-1 rounded-2xl bg-muted/40 py-3 shadow-none"><CardContent><span className="block text-[10px] tracking-wide text-muted-foreground uppercase">{t("welcome.hero.dashboard.statConvLabel")}</span><strong className="mt-1 block text-lg">{t("welcome.hero.dashboard.statConvValue")}</strong></CardContent></Card>
                        <Card size="sm" className="gap-1 rounded-2xl bg-muted/40 py-3 shadow-none"><CardContent><span className="block text-[10px] tracking-wide text-muted-foreground uppercase">{t("welcome.hero.dashboard.statResponseLabel")}</span><strong className="mt-1 block text-lg">{t("welcome.hero.dashboard.statResponseValue")}</strong></CardContent></Card>
                      </div>
                      <div className="mt-6 overflow-hidden rounded-2xl border">
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

                    <div
                      className={cn(
                        "absolute inset-0 p-5 transition-opacity duration-500 sm:p-8",
                        heroActiveNav === "playground" ? "opacity-100" : "pointer-events-none opacity-0",
                      )}
                    >
                      <h3 className="font-heading text-lg font-medium">{t("nav.playground")}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{t("welcome.hero.playgroundMock.subtitle")}</p>
                      <div className="mt-6 flex items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></span>
                        <div>
                          <strong className="block text-sm">{t("welcome.hero.dashboard.row1Agent")}</strong>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" />{t("welcome.hero.playgroundMock.modelConfigured")}</span>
                        </div>
                      </div>
                      <div className="mt-6 space-y-4">
                        <div className="flex flex-row-reverse gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></span>
                          <div className="max-w-[75%] rounded-xl border bg-background p-3 text-sm shadow-sm">{t("welcome.hero.playgroundMock.userMsg")}</div>
                        </div>
                        <div className="flex gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="size-4" /></span>
                          <div className="max-w-[75%] rounded-xl border bg-background p-3 text-sm shadow-sm">{t("welcome.hero.playgroundMock.agentMsg")}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
                    <span className="marketing-hero-click-nav absolute top-[35%] left-[9%] size-8 rounded-full border-2 border-primary" />
                    <MousePointer2 className="marketing-hero-cursor absolute z-10 size-5 fill-white text-black drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]" />
                  </div>
                </div>
              </Safari>
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
            <BentoGrid className="auto-rows-[minmax(16rem,auto)] grid-cols-1 gap-4 sm:grid-cols-3">
              {TAB_IDS.map((id) => {
                const Icon = TAB_ICONS[id];
                const isAgents = id === "agents";
                return (
                  <BentoCard
                    key={id}
                    name={isAgents ? t(`welcome.panels.${id}.title`) : t(`welcome.tabs.${id}.label`)}
                    description={isAgents ? t(`welcome.panels.${id}.body`) : t(`welcome.tabs.${id}.sub`)}
                    Icon={Icon}
                    className={BENTO_SPAN[id]}
                    background={<Icon aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-40 text-primary/5" />}
                  >
                    {id === "agents" ? (
                      <>
                        <ul className="mt-4 space-y-2.5">
                          <li className="flex gap-2.5 text-sm text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t(`welcome.panels.${id}.p1`)}</li>
                          <li className="flex gap-2.5 text-sm text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t(`welcome.panels.${id}.p2`)}</li>
                          <li className="flex gap-2.5 text-sm text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t(`welcome.panels.${id}.p3`)}</li>
                        </ul>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="font-mono text-[11px] font-normal">gpt-4o-mini</Badge>
                          <Badge variant="secondary" className="font-mono text-[11px] font-normal">temp 0.7</Badge>
                          <Badge variant="secondary" className="font-mono text-[11px] font-normal">vision on</Badge>
                        </div>
                      </>
                    ) : null}
                    {id === "knowledge" ? (
                      <div className="mt-4 space-y-2">
                        {["Pricing.pdf", "Onboarding.pdf"].map((file) => (
                          <div key={file} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2 text-xs">
                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{file}</span>
                            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {id === "tools" ? (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2 font-mono text-xs">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">POST</Badge>
                          <span className="truncate text-muted-foreground">/webhook/order-created</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2 font-mono text-xs">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">GET</Badge>
                          <span className="truncate text-muted-foreground">/crm/customer/:id</span>
                        </div>
                      </div>
                    ) : null}
                    {id === "channels" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border bg-muted/30 py-1.5 pr-3 pl-1.5 text-xs font-medium"><span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Radio className="size-3" /></span>WhatsApp Cloud API</span>
                        <span className="inline-flex items-center gap-2 rounded-full border bg-muted/30 py-1.5 pr-3 pl-1.5 text-xs font-medium"><span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Radio className="size-3" /></span>WhatsApp QR</span>
                        <span className="inline-flex items-center gap-2 rounded-full border bg-muted/30 py-1.5 pr-3 pl-1.5 text-xs font-medium"><span className="grid size-5 place-items-center rounded-full bg-primary/15 text-primary"><MessageCircle className="size-3" /></span>Web widget</span>
                      </div>
                    ) : null}
                  </BentoCard>
                );
              })}
            </BentoGrid>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24" id="channels">
          <div className={containerClass}>
            <div className="mb-10 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.ops.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.ops.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.ops.sub")}</p>
            </div>
            <BentoGrid className="auto-rows-[minmax(20rem,auto)] grid-cols-1 gap-4 sm:grid-cols-3">
              <BentoCard
                name={t("welcome.ops.inbox.title")}
                description={t("welcome.ops.inbox.body")}
                Icon={Inbox}
                className="col-span-1"
                background={<Inbox aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-40 text-primary/5" />}
              >
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/30 text-[10px] font-medium text-primary-foreground">N</span>
                      <span className="truncate">Nova Studio</span>
                    </span>
                    <Badge className="shrink-0 px-1.5 py-0 text-[10px] font-normal">3</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/30 text-[10px] font-medium text-primary-foreground">B</span>
                      <span className="truncate">Bright Bakery</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">2m</span>
                  </div>
                </div>
              </BentoCard>
              <BentoCard
                name={t("welcome.ops.portals.title")}
                description={t("welcome.ops.portals.body")}
                Icon={Globe}
                className="col-span-1"
                background={<Globe aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-40 text-primary/5" />}
              >
                <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs">
                  <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">portal.novastudio.com</span>
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                </div>
              </BentoCard>
              <BentoCard
                name={t("welcome.ops.whitelabel.title")}
                description={t("welcome.ops.whitelabel.body")}
                Icon={Building2}
                className="col-span-1"
                background={<Building2 aria-hidden="true" className="pointer-events-none absolute -top-8 -right-8 size-40 text-primary/5" />}
              >
                <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <span className="flex shrink-0">
                    <span className="size-4 rounded-full bg-primary ring-2 ring-background" />
                    <span className="-ml-2 size-4 rounded-full bg-foreground ring-2 ring-background" />
                  </span>
                  <span className="flex-1 truncate">Nova Studio brand</span>
                </div>
              </BentoCard>
            </BentoGrid>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24" id="open-source">
          <div className={containerClass}>
            <Card className="relative isolate grid gap-10 border-0 bg-primary px-2 py-8 text-primary-foreground ring-primary/20 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-10 lg:py-12">
              <GrainLayer />
              <div className="relative z-10 px-5">
                <Eyebrow inverse>{t("welcome.stack.eyebrow")}</Eyebrow>
                <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.stack.title")}</h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-primary-foreground/80">{t("welcome.stack.body")}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button className={ctaClass} render={<a href="https://openvoiss.com/docs/self-hosting" />} nativeButton={false}>{t("welcome.stack.guideBtn")}</Button>
                  <Button className={ctaClass} variant="secondary" render={<a href="https://openvoiss.com/docs/architecture" />} nativeButton={false}>{t("welcome.stack.archBtn")}</Button>
                </div>
              </div>
              <div className="relative z-10 px-5">
                <Terminal className="w-full max-w-none border-black/10 bg-background font-mono shadow-xl">
                  <TypingAnimation className="text-foreground">$ git clone https://github.com/kanazawa-dev/openvoiss.git</TypingAnimation>
                  <TypingAnimation className="text-foreground">$ cd openvoiss</TypingAnimation>
                  <TypingAnimation className="text-foreground">$ make setup</TypingAnimation>
                  <TypingAnimation className="text-foreground">$ make up</TypingAnimation>
                  <AnimatedSpan className="text-emerald-600">{"✔ api        running   :8000"}</AnimatedSpan>
                  <AnimatedSpan className="text-emerald-600">{"✔ web        running   :3000"}</AnimatedSpan>
                  <AnimatedSpan className="text-emerald-600">{"✔ whatsapp   running   :3101"}</AnimatedSpan>
                  <AnimatedSpan className="text-emerald-600">{"✔ db         running   :5432"}</AnimatedSpan>
                  <AnimatedSpan className="text-muted-foreground">Open http://localhost — your agency is live.</AnimatedSpan>
                </Terminal>
              </div>
              <div className="relative z-10 col-span-full grid gap-5 border-t border-primary-foreground/15 px-5 pt-8 sm:grid-cols-3">
                {(["step1", "step2", "step3"] as const).map((step, index) => (
                  <div className="flex gap-3" key={step}>
                    <span className="shrink-0 font-mono text-sm font-medium text-primary-foreground/60">{String(index + 1).padStart(2, "0")}</span>
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
                <CardFooter><Button className={ctaClass} render={<a href={`${appUrl}/login`} />} nativeButton={false}>{t("welcome.plans.selfhost.cta")}</Button></CardFooter>
              </Card>

              <Card className="relative isolate border-0 bg-primary text-primary-foreground ring-primary/20">
                <GrainLayer />
                <BorderBeam duration={8} size={160} colorFrom="#9fe870" colorTo="#ffffff" />
                <CardHeader className="relative z-10"><Badge className="mb-2 bg-primary-foreground/10 text-primary-foreground" variant="secondary">{t("welcome.plans.cloud.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.cloud.title")}</CardTitle><div><div className="font-heading text-3xl font-semibold">{t("welcome.plans.cloud.price")}</div><div className="mt-1 text-sm text-primary-foreground/75">{t("welcome.plans.cloud.included")}</div></div></CardHeader>
                <CardContent className="relative z-10 flex flex-1 flex-col gap-5"><p className="leading-6 text-primary-foreground/80">{t("welcome.plans.cloud.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0" />{t("welcome.plans.cloud.p4")}</li></ul></CardContent>
                <CardFooter className="relative z-10"><Button className={ctaClass} variant="secondary" render={<a href="https://github.com/kanazawa-dev/openvoiss/discussions" />} nativeButton={false}>{t("welcome.plans.cloud.cta")}</Button></CardFooter>
              </Card>

              <Card>
                <CardHeader><Badge className="mb-2" variant="secondary">{t("welcome.plans.enterprise.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.enterprise.title")}</CardTitle><div><div className="font-heading text-3xl font-semibold text-primary-foreground">{t("welcome.plans.enterprise.price")}</div><div className="mt-1 text-sm text-muted-foreground">{t("welcome.plans.enterprise.included")}</div></div></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5"><p className="leading-6 text-muted-foreground">{t("welcome.plans.enterprise.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary-foreground" />{t("welcome.plans.enterprise.p4")}</li></ul></CardContent>
                <CardFooter><Button className={ctaClass} variant="secondary" render={<a href="mailto:enterprise@openvoiss.com" />} nativeButton={false}>{t("welcome.plans.enterprise.cta")}</Button></CardFooter>
              </Card>
            </div>

            <div className="mt-14 mb-5 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.compare.eyebrow")}</Eyebrow>
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.compare.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.compare.sub")}</p>
            </div>
            <Card className="relative gap-0 overflow-hidden py-0">
              <BorderBeam duration={10} size={200} colorFrom="#9fe870" colorTo="#ffffff" />
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
                <Button className={ctaClass} render={<a href={`${appUrl}/login`} />} nativeButton={false}>{t("welcome.nav.getStarted")}</Button>
                <Button className={ctaClass} variant="secondary" render={<a href="https://github.com/kanazawa-dev/openvoiss" />} nativeButton={false}>{t("welcome.cta.star")}</Button>
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

"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  FileText,
  Github,
  Globe,
  HelpCircle,
  Inbox,
  Layers,
  Menu,
  MessageCircle,
  MessageSquareText,
  Mic,
  Radio,
  Server,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Benday, useDotMap } from "@/components/ui/benday";
import DitherBackground from "@/components/ui/dither-background";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { CloudInterestDialog } from "@/components/cloud-interest-dialog";
import { RandomizedTextEffect } from "@/components/ui/randomized-text-effect";
import { TerminalIntroSequence, type TerminalPhase } from "@/components/ui/terminal-ui";
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

// Distinct dither tunings so adjacent cards don't render the same static-looking pattern.
const GRAIN_VARIANTS = {
  a: { waveSpeed: 0.01, waveAmplitude: 0.31, waveFrequency: 1.8, colorNum: 2.5 },
  b: { waveSpeed: 0.015, waveAmplitude: 0.45, waveFrequency: 2.4, colorNum: 3 },
  c: { waveSpeed: 0.008, waveAmplitude: 0.22, waveFrequency: 1.3, colorNum: 2 },
  d: { waveSpeed: 0.012, waveAmplitude: 0.38, waveFrequency: 2.1, colorNum: 2.5 },
} as const;

const FAQ_IDS = [1, 2, 3, 4, 5] as const;

const trustItems = ["mit", "selfhost", "compatible", "isolated", "whatsapp", "multiClient", "byok", "whitelabel"] as const;

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

function HeroSparkMark({ size }: { size: number }) {
  const { dotMap } = useDotMap("/brand/only-logo.png", { grid: Math.max(16, Math.min(32, Math.round(size / 2))) });
  return (
    <Benday
      aria-label="Voysse"
      color="#1748c7"
      dotMap={dotMap ?? undefined}
      padding={0.06}
      preset="resolve"
      reducedMotion="auto"
      size={size}
      state="thinking"
    />
  );
}

function GrainLayer({
  className,
  colorNum = 2.5,
  waveAmplitude = 1,
  waveSpeed,
  waveFrequency,
}: {
  className?: string;
  colorNum?: number;
  waveAmplitude?: number;
  waveSpeed?: number;
  waveFrequency?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    // Each DitherBackground mounts its own WebGL context. This page has a
    // dozen GrainLayer instances, well past the ~8-16 concurrent WebGL
    // context budget most browsers enforce — mounting one canvas only while
    // its card is (near) the viewport keeps the live count small instead of
    // silently losing contexts to the browser's limit.
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden="true">
      {isVisible ? (
        <DitherBackground
          className="absolute inset-0"
          colorNum={colorNum}
          waveAmplitude={waveAmplitude}
          waveSpeed={waveSpeed}
          waveFrequency={waveFrequency}
          waveColor={[0.09, 0.282, 0.78]}
          backgroundColor={[0.98, 0.969, 0.937]}
          enableMouseInteraction={false}
          disableAnimation
        />
      ) : null}
      <div className="absolute inset-0 bg-background/80" />
    </div>
  );
}

function Eyebrow({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-pixel text-xs font-semibold tracking-[0.16em] uppercase", inverse ? "text-primary-foreground" : "text-primary")}>
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

  const terminalSequence: TerminalPhase[] = [
    { type: "divider" },
    {
      type: "bar",
      labels: [t("welcome.stack.terminal.bar1Step1"), t("welcome.stack.terminal.bar1Step2"), t("welcome.stack.terminal.bar1Step3")],
      icons: ["✦", "◆", "✶", "❋", "✸"],
      duration: 3000,
      showPercent: true,
    },
    { type: "lines", lines: [t("welcome.stack.terminal.line1"), t("welcome.stack.terminal.line2"), t("welcome.stack.terminal.line3")] },
    { type: "divider" },
    {
      type: "bar",
      labels: [t("welcome.stack.terminal.bar2Step1"), t("welcome.stack.terminal.bar2Step2"), t("welcome.stack.terminal.bar2Step3")],
      icons: ["◈", "◉", "⬡", "⬢", "◍"],
      duration: 3000,
      showPercent: true,
    },
    { type: "message", text: t("welcome.stack.terminal.message") },
  ];

  const resourceLinks: NavRow[] = [
    { href: "#channels", icon: MessageCircle, title: t("welcome.nav.channels"), desc: t("welcome.nav.resourcesMenu.channelsDesc") },
    { href: "#open-source", icon: Server, title: t("welcome.nav.selfhost"), desc: t("welcome.nav.resourcesMenu.selfhostDesc") },
    { href: "#faq", icon: HelpCircle, title: t("welcome.nav.faq"), desc: t("welcome.nav.resourcesMenu.faqDesc") },
    { href: "#roadmap", icon: Layers, title: t("welcome.nav.roadmap"), desc: t("welcome.nav.resourcesMenu.roadmapDesc") },
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
      <nav className="absolute inset-x-0 top-0 z-40 bg-transparent">
        <div className={cn(containerClass, "flex h-[74px] items-center gap-2 sm:gap-4")}>
          <a href="#top" aria-label="Voysse" className="shrink-0">
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
            <Button className="hidden sm:inline-flex" variant="outline" size="sm" render={<a href="https://github.com/kanazawa-dev/voysse" />} nativeButton={false}>
              <Github className="size-4" /> <span className="hidden xl:inline">GitHub</span>
            </Button>
            <Button className="hidden min-[370px]:inline-flex" size="sm" render={<a href={`${appUrl}/login`} />} nativeButton={false}>
              {t("welcome.nav.getStarted")}
            </Button>
          </div>
        </div>
      </nav>

      <main id="top">
        <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden py-16 sm:py-20 lg:py-28">
          <div className="pointer-events-none absolute -top-16 -right-80 -bottom-16 hidden translate-y-32 aspect-[1157/1018] sm:-top-20 sm:-bottom-20 md:block lg:-top-28 lg:-right-64 lg:-bottom-28 xl:-right-52">
            <img src="/boss-final-waist.png" alt="" className="h-full w-full object-contain object-top select-none" />
            <div className="absolute top-[63.5%] left-[-1.5%] z-10 -translate-y-[7px] translate-x-[5px]">
              <HeroSparkMark size={132} />
            </div>
          </div>
          <div className={cn(containerClass, "relative")}>
            <div className="relative z-10 flex max-w-xl flex-col items-start text-left lg:max-w-3xl xl:max-w-4xl">
              <h1 className="font-pixel text-7xl leading-[0.92] font-semibold tracking-[-0.04em] text-balance sm:text-8xl lg:text-9xl">
                <RandomizedTextEffect text={t("welcome.hero.titleLine1")} />
                <br />
                <RandomizedTextEffect text={t("welcome.hero.titleLine2")} />
              </h1>
              <p className="mt-8 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">{t("welcome.hero.sub")}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button className={ctaClass} render={<a href={`${appUrl}/login`} />} nativeButton={false}>
                  {t("welcome.nav.getStarted")} <ArrowRight className="size-4" />
                </Button>
                <Button className={ctaClass} variant="secondary" render={<a href="https://openvoiss.com/docs/getting-started" />} nativeButton={false}>
                  {t("welcome.hero.readDocs")}
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{t("welcome.hero.note")}</p>
            </div>
          </div>
        </section>

        <section className="relative isolate -mt-5 overflow-hidden py-8">
          <GrainLayer />
          <div
            className={cn(
              "w-full inline-flex flex-nowrap overflow-hidden",
              "[mask-image:linear-gradient(to_right,transparent_0,black_128px,black_calc(100%-128px),transparent_100%)]",
              "[-webkit-mask-image:linear-gradient(to_right,transparent_0,black_128px,black_calc(100%-128px),transparent_100%)]",
            )}
          >
            {[0, 1].map((rep) => (
              <ul
                key={rep}
                aria-hidden={rep === 1 ? true : undefined}
                className="marketing-brand-scroll flex w-max shrink-0 items-center gap-7 animate-infinite-scroll"
              >
                {trustItems.map((key) => (
                  <li key={key} className="flex items-center gap-7">
                    <span className="font-heading text-xl font-black text-background uppercase whitespace-nowrap sm:text-2xl">{t(`welcome.trust.${key}`)}</span>
                    <span className="text-background/60">&bull;</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        <section className={sectionClass} id="features">
          <div className={containerClass}>
            <div className="mb-10 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.features.eyebrow")}</Eyebrow>
              <h2 className="font-pixel text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.features.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.features.sub")}</p>
            </div>
            <BentoGrid className="auto-rows-[minmax(16rem,auto)] grid-cols-1 gap-4 sm:grid-cols-3">
              {TAB_IDS.map((id) => {
                const Icon = TAB_ICONS[id];
                const isAgents = id === "agents";
                const grain = { agents: GRAIN_VARIANTS.a, knowledge: GRAIN_VARIANTS.b, tools: GRAIN_VARIANTS.c, channels: GRAIN_VARIANTS.d }[id];
                return (
                  <BentoCard
                    key={id}
                    name={isAgents ? t(`welcome.panels.${id}.title`) : t(`welcome.tabs.${id}.label`)}
                    description={isAgents ? t(`welcome.panels.${id}.body`) : t(`welcome.tabs.${id}.sub`)}
                    Icon={Icon}
                    className={BENTO_SPAN[id]}
                    background={<GrainLayer {...grain} />}
                  >
                    {id === "agents" ? (
                      <>
                        <ul className="mt-4 space-y-2.5 font-semibold">
                          <li className="flex gap-2.5 text-base text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t(`welcome.panels.${id}.p1`)}</li>
                          <li className="flex gap-2.5 text-base text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t(`welcome.panels.${id}.p2`)}</li>
                          <li className="flex gap-2.5 text-base text-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t(`welcome.panels.${id}.p3`)}</li>
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
                          <div key={file} className="flex items-center gap-2 rounded-lg border bg-background/85 px-2.5 py-2 text-sm font-semibold">
                            <FileText className="size-3.5 shrink-0 text-foreground" />
                            <span className="flex-1 truncate text-foreground">{file}</span>
                            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {id === "tools" ? (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 rounded-lg border bg-background/85 px-2.5 py-2 font-mono text-sm font-semibold">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">POST</Badge>
                          <span className="truncate text-foreground">/webhook/order-created</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border bg-background/85 px-2.5 py-2 font-mono text-sm font-semibold">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">GET</Badge>
                          <span className="truncate text-foreground">/crm/customer/:id</span>
                        </div>
                      </div>
                    ) : null}
                    {id === "channels" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border bg-background/85 py-1.5 pr-3 pl-1.5 text-sm font-semibold text-foreground"><span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Radio className="size-3" /></span>WhatsApp Cloud API</span>
                        <span className="inline-flex items-center gap-2 rounded-full border bg-background/85 py-1.5 pr-3 pl-1.5 text-sm font-semibold text-foreground"><span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600"><Radio className="size-3" /></span>WhatsApp QR</span>
                        <span className="inline-flex items-center gap-2 rounded-full border bg-background/85 py-1.5 pr-3 pl-1.5 text-sm font-semibold text-foreground"><span className="grid size-5 place-items-center rounded-full bg-primary/15 text-primary"><MessageCircle className="size-3" /></span>Web widget</span>
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
              <h2 className="font-pixel text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.ops.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.ops.sub")}</p>
            </div>
            <BentoGrid className="auto-rows-[minmax(20rem,auto)] grid-cols-1 gap-4 sm:grid-cols-3">
              <BentoCard
                name={t("welcome.ops.inbox.title")}
                description={t("welcome.ops.inbox.body")}
                Icon={Inbox}
                className="col-span-1"
                background={<GrainLayer {...GRAIN_VARIANTS.a} />}
              >
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/85 px-2.5 py-2 text-sm font-semibold">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/30 text-[10px] font-medium text-primary-foreground">N</span>
                      <span className="truncate text-foreground">Nova Studio</span>
                    </span>
                    <Badge className="shrink-0 px-1.5 py-0 text-[10px] font-normal">3</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/85 px-2.5 py-2 text-sm font-semibold">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/30 text-[10px] font-medium text-primary-foreground">B</span>
                      <span className="truncate text-foreground">Bright Bakery</span>
                    </span>
                    <span className="shrink-0 text-foreground">2m</span>
                  </div>
                </div>
              </BentoCard>
              <BentoCard
                name={t("welcome.ops.portals.title")}
                description={t("welcome.ops.portals.body")}
                Icon={Globe}
                className="col-span-1"
                background={<GrainLayer {...GRAIN_VARIANTS.b} />}
              >
                <div className="mt-4 flex items-center gap-2 rounded-lg border bg-background/85 px-3 py-2 font-mono text-sm font-semibold">
                  <Globe className="size-3.5 shrink-0 text-foreground" />
                  <span className="flex-1 truncate text-foreground">portal.novastudio.com</span>
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                </div>
              </BentoCard>
              <BentoCard
                name={t("welcome.ops.whitelabel.title")}
                description={t("welcome.ops.whitelabel.body")}
                Icon={Building2}
                className="col-span-1"
                background={<GrainLayer {...GRAIN_VARIANTS.c} />}
              >
                <div className="mt-4 flex items-center gap-2 rounded-lg border bg-background/85 px-3 py-2 text-sm font-semibold">
                  <span className="flex shrink-0">
                    <span className="size-4 rounded-full bg-primary ring-2 ring-background" />
                    <span className="-ml-2 size-4 rounded-full bg-foreground ring-2 ring-background" />
                  </span>
                  <span className="flex-1 truncate text-foreground">Nova Studio brand</span>
                </div>
              </BentoCard>
            </BentoGrid>
          </div>
        </section>

        <section className="pb-14 md:pb-20 lg:pb-24" id="open-source">
          <div className={containerClass}>
            <Card className="relative isolate grid gap-10 border-0 bg-primary px-2 py-8 text-primary ring-primary/20 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-10 lg:py-12">
              <GrainLayer {...GRAIN_VARIANTS.a} />
              <div className="relative z-10 px-5">
                <Eyebrow>{t("welcome.stack.eyebrow")}</Eyebrow>
                <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.stack.title")}</h2>
                <p className="mt-6 max-w-xl text-lg leading-7 font-semibold text-primary">{t("welcome.stack.body")}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button className={ctaClass} render={<a href="https://openvoiss.com/docs/self-hosting" />} nativeButton={false}>{t("welcome.stack.guideBtn")}</Button>
                  <Button className={ctaClass} variant="secondary" render={<a href="https://openvoiss.com/docs/architecture" />} nativeButton={false}>{t("welcome.stack.archBtn")}</Button>
                </div>
              </div>
              <div className="relative z-10 px-5">
                <TerminalIntroSequence
                  sequence={terminalSequence}
                  className="w-full max-w-none overflow-hidden rounded-2xl shadow-xl"
                />
              </div>
              <div className="relative z-10 col-span-full grid gap-5 border-t border-primary/15 px-5 pt-8 sm:grid-cols-3">
                {(["step1", "step2", "step3"] as const).map((step, index) => (
                  <div className="flex gap-3" key={step}>
                    <span className="shrink-0 font-pixel text-base font-medium text-primary/60">{String(index + 1).padStart(2, "0")}</span>
                    <div><strong className="block font-heading font-medium">{t(`welcome.stack.${step}.title`)}</strong><span className="mt-1 block text-base font-semibold text-primary">{t(`welcome.stack.${step}.body`)}</span></div>
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
              <h2 className="font-pixel text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.plans.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.plans.sub")}</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <CardHeader><Badge className="mb-2" variant="default">{t("welcome.plans.selfhost.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.selfhost.title")}</CardTitle><div className="font-heading text-3xl font-semibold text-primary">{t("welcome.plans.selfhost.price")}</div></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5"><p className="leading-6 text-muted-foreground">{t("welcome.plans.selfhost.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.selfhost.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.selfhost.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.selfhost.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.selfhost.p4")}</li></ul></CardContent>
                <CardFooter><Button className={ctaClass} render={<a href={`${appUrl}/login`} />} nativeButton={false}>{t("welcome.plans.selfhost.cta")}</Button></CardFooter>
              </Card>

              <Card className="relative isolate border-0 bg-primary text-primary ring-primary/20">
                <GrainLayer {...GRAIN_VARIANTS.a} />
                <BorderBeam duration={8} size={160} colorFrom="#78a7ff" colorTo="#fffdf7" />
                <CardHeader className="relative z-10"><Badge className="mb-2 bg-primary/10 text-primary" variant="secondary">{t("welcome.plans.cloud.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.cloud.title")}</CardTitle><div><div className="font-heading text-3xl font-semibold">{t("welcome.plans.cloud.price")}</div><div className="mt-1 text-base font-semibold text-primary">{t("welcome.plans.cloud.included")}</div></div></CardHeader>
                <CardContent className="relative z-10 flex flex-1 flex-col gap-5"><p className="text-base leading-6 font-semibold text-primary">{t("welcome.plans.cloud.desc")}</p><ul className="space-y-2.5 font-semibold"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.cloud.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.cloud.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.cloud.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.cloud.p4")}</li></ul></CardContent>
                <CardFooter className="relative z-10"><CloudInterestDialog triggerClassName={ctaClass} /></CardFooter>
              </Card>

              <Card>
                <CardHeader><Badge className="mb-2" variant="secondary">{t("welcome.plans.enterprise.tag")}</Badge><CardTitle className="text-2xl">{t("welcome.plans.enterprise.title")}</CardTitle><div><div className="font-heading text-3xl font-semibold text-primary">{t("welcome.plans.enterprise.price")}</div><div className="mt-1 text-sm text-muted-foreground">{t("welcome.plans.enterprise.included")}</div></div></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5"><p className="leading-6 text-muted-foreground">{t("welcome.plans.enterprise.desc")}</p><ul className="space-y-2.5"><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.enterprise.p1")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.enterprise.p2")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.enterprise.p3")}</li><li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t("welcome.plans.enterprise.p4")}</li></ul></CardContent>
                <CardFooter><Button className={ctaClass} variant="secondary" render={<a href="mailto:enterprise@openvoiss.com" />} nativeButton={false}>{t("welcome.plans.enterprise.cta")}</Button></CardFooter>
              </Card>
            </div>

            <div className="mt-14 mb-5 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.compare.eyebrow")}</Eyebrow>
              <h2 className="font-pixel text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.compare.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.compare.sub")}</p>
            </div>
            <Card className="relative gap-0 overflow-hidden py-0">
              <BorderBeam duration={10} size={200} colorFrom="#78a7ff" colorTo="#fffdf7" />
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

        <section className="pb-14 md:pb-20 lg:pb-24" id="roadmap">
          <div className={containerClass}>
            <div className="mb-10 max-w-2xl space-y-3">
              <Eyebrow>{t("welcome.roadmap.eyebrow")}</Eyebrow>
              <h2 className="font-pixel text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.roadmap.title")}</h2>
              <p className="text-base leading-7 text-muted-foreground">{t("welcome.roadmap.sub")}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {([["channels", MessageCircle], ["voice", Mic], ["ops", Users], ["platform", Layers]] as const).map(([key, Icon]) => (
                <Card key={key} className="p-5">
                  <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <h3 className="font-heading text-lg font-semibold">{t(`welcome.roadmap.${key}.title`)}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t(`welcome.roadmap.${key}.desc`)}</p>
                </Card>
              ))}
            </div>
            <div className="mt-8">
              <Button variant="outline" render={<a href="https://openvoiss.com/docs/roadmap" />} nativeButton={false}>{t("welcome.roadmap.cta")} <ArrowRight className="size-4" /></Button>
            </div>
          </div>
        </section>

        <section className={sectionClass} id="faq">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
            <div className="mb-9 space-y-3 text-center">
              <Eyebrow>{t("welcome.faq.eyebrow")}</Eyebrow>
              <h2 className="font-pixel text-3xl font-semibold tracking-tight sm:text-4xl">{t("welcome.faq.title")}</h2>
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
            <Card className="relative isolate items-center border-0 bg-primary px-4 py-14 text-center text-primary ring-primary/20 sm:px-10 sm:py-20">
              <GrainLayer {...GRAIN_VARIANTS.a} />
              <CardHeader className="relative z-10 w-full justify-items-center"><CardTitle className="w-full max-w-3xl font-pixel text-3xl sm:text-5xl">{t("welcome.cta.title")}</CardTitle></CardHeader>
              <CardContent className="relative z-10"><p className="max-w-lg text-lg leading-7 font-semibold text-primary">{t("welcome.cta.body")}</p></CardContent>
              <CardFooter className="relative z-10 flex-wrap justify-center gap-3">
                <Button className={ctaClass} render={<a href={`${appUrl}/login`} />} nativeButton={false}>{t("welcome.nav.getStarted")}</Button>
                <Button className={ctaClass} variant="secondary" render={<a href="https://github.com/kanazawa-dev/voysse" />} nativeButton={false}>{t("welcome.cta.star")}</Button>
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
              <div><strong className="mb-3 block text-xs tracking-wider text-muted-foreground uppercase">{t("welcome.footer.colProduct")}</strong><div className="space-y-2 text-sm"><a className="block hover:text-primary" href="#features">{t("welcome.nav.features")}</a><a className="block hover:text-primary" href="#channels">{t("welcome.ops.eyebrow")}</a><a className="block hover:text-primary" href="#open-source">{t("welcome.nav.selfhost")}</a><a className="block hover:text-primary" href="#pricing">{t("welcome.nav.pricing")}</a><a className="block hover:text-primary" href="#roadmap">{t("welcome.nav.roadmap")}</a></div></div>
              <div><strong className="mb-3 block text-xs tracking-wider text-muted-foreground uppercase">{t("welcome.footer.colResources")}</strong><div className="space-y-2 text-sm"><a className="block hover:text-primary" href="https://openvoiss.com/docs">{t("welcome.footer.docs")}</a><a className="block hover:text-primary" href="https://openvoiss.com/docs/getting-started">{t("welcome.footer.quickstart")}</a><a className="block hover:text-primary" href="https://github.com/kanazawa-dev/voysse/discussions">{t("welcome.footer.discussions")}</a></div></div>
              <div><strong className="mb-3 block text-xs tracking-wider text-muted-foreground uppercase">{t("welcome.footer.colProject")}</strong><div className="space-y-2 text-sm"><a className="block hover:text-primary" href="https://github.com/kanazawa-dev/voysse">GitHub</a><a className="block hover:text-primary" href="https://openvoiss.com/docs/contributing">{t("welcome.footer.contributing")}</a></div></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground"><span>{t("welcome.footer.license")}</span><div className="flex flex-wrap items-center gap-x-4 gap-y-1"><a className="hover:text-primary" href="/privacy">{t("welcome.footer.privacy")}</a><a className="hover:text-primary" href="/terms">{t("welcome.footer.terms")}</a><span>{t("welcome.footer.tagline")}</span></div></div>
        </div>
      </footer>
    </div>
  );
}

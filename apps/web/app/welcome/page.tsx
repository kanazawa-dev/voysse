"use client";

import { useState } from "react";
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
  Menu,
  MessageCircle,
  MessageSquareText,
  Server,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./welcome.module.css";

type TabId = "agents" | "knowledge" | "tools" | "channels";

const TAB_IDS: TabId[] = ["agents", "knowledge", "tools", "channels"];
const TAB_ICONS: Record<TabId, typeof MessageSquareText> = {
  agents: MessageSquareText,
  knowledge: BookOpen,
  tools: Wrench,
  channels: MessageCircle,
};

const FAQ_IDS = [1, 2, 3, 4, 5] as const;

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function WelcomePage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabId>("agents");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set());

  function toggleFaq(id: number) {
    setOpenFaq((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  type NavRow = { href: string; icon: typeof MessageCircle; title: string; desc: string };
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

  function menuRows(rows: NavRow[]) {
    return rows.map(({ href, icon: Icon, title, desc }) => (
      <a key={href} href={href} className={styles.menuRow} onClick={() => setMenuOpen(false)}>
        <span className={styles.menuRowIcon}><Icon size={18} /></span>
        <span>
          <span className={styles.menuRowTitle}>{title}</span>
          <span className={styles.menuRowDesc}>{desc}</span>
        </span>
      </a>
    ));
  }

  return (
    <div className={styles.page}>
      <nav className={styles.topbar}>
        <div className={cx(styles.wrap, styles.topbarInner)}>
          <a href="#top" aria-label="Openvoiss"><img className={styles.wordmark} src="/brand/word-logo.png" alt="Openvoiss" /></a>

          <div className={styles.navLinks}>
            <a href="#features">{t("welcome.nav.features")}</a>
            <a href="#pricing">{t("welcome.nav.pricing")}</a>
            <div className={styles.navMenuWrap}>
              <button className={styles.resourcesTrigger} onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
                {t("welcome.nav.resources")}
                <ChevronDown size={14} className={cx(styles.menuChevron, menuOpen && styles.menuChevronOpen)} />
              </button>
              {menuOpen && (
                <>
                  <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
                  <div className={styles.menuDropdown}>{menuRows(resourceLinks)}</div>
                </>
              )}
            </div>
          </div>

          <div className={styles.mobileNavWrap}>
            <button className={styles.mobileMenuTrigger} onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label={t("welcome.nav.resources")}>
              <Menu size={18} />
            </button>
            {menuOpen && (
              <>
                <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
                <div className={cx(styles.menuDropdown, styles.menuDropdownLeft)}>{menuRows(allLinks)}</div>
              </>
            )}
          </div>

          <div className={styles.navActions}>
            <span className={styles.langSwitchWrap}><LanguageSwitcher /></span>
            <a className={cx(styles.btn, styles.btnGhost, styles.btnSm, styles.navGhostLink)} href="https://github.com/kanazawa-dev/openvoiss">
              <Github size={16} className={styles.icon} /> <span className={styles.navGhostLabel}>GitHub</span>
            </a>
            <a className={cx(styles.btn, styles.btnPrimary, styles.btnSm)} href="/login">{t("welcome.nav.getStarted")}</a>
          </div>
        </div>
      </nav>

      <main id="top">
        <section className={styles.hero}>
          <div className={cx(styles.heroBlob, styles.heroBlobOne)} />
          <div className={cx(styles.heroBlob, styles.heroBlobTwo)} />
          <div className={cx(styles.wrap, styles.heroInner)}>
            <div>
              <span className={styles.eyebrow}>{t("welcome.hero.eyebrow")}</span>
              <h1>{t("welcome.hero.titleLine1")}<br />{t("welcome.hero.titleLine2")}</h1>
              <p className={styles.heroSub}>{t("welcome.hero.sub")}</p>
              <div className={styles.heroCta}>
                <a className={cx(styles.btn, styles.btnPrimary)} href="/login">
                  {t("welcome.nav.getStarted")} <ArrowRight size={17} />
                </a>
                <a className={cx(styles.btn, styles.btnSecondary)} href="https://openvoiss.com/docs/getting-started">{t("welcome.hero.readDocs")}</a>
              </div>
              <p className={styles.heroNote}>{t("welcome.hero.note")}</p>
            </div>
            <div className={styles.orbWrap} aria-hidden="true">
              <div className={styles.orbGlow} />
              <div className={cx(styles.orbRing, styles.orbRingOne)} />
              <div className={cx(styles.orbRing, styles.orbRingTwo)} />
              <div className={cx(styles.orbRing, styles.orbRingThree)} />
              <div className={styles.orbParticles}>
                <span className={cx(styles.orbParticle, styles.orbParticleOne)} />
                <span className={cx(styles.orbParticle, styles.orbParticleTwo)} />
                <span className={cx(styles.orbParticle, styles.orbParticleThree)} />
              </div>
              <div className={styles.orbCore} />
            </div>
          </div>
        </section>

        <section className={styles.trust}>
          <div className={styles.marquee} aria-hidden="true">
            <div className={styles.marqueeTrack}>
              {[0, 1].map((rep) => (
                <span key={rep} style={{ display: "contents" }}>
                  <span className={styles.marqueeItem}>{t("welcome.trust.mit")}</span><span className={styles.marqueeDot}>&bull;</span>
                  <span className={styles.marqueeItem}>{t("welcome.trust.selfhost")}</span><span className={styles.marqueeDot}>&bull;</span>
                  <span className={styles.marqueeItem}>{t("welcome.trust.compatible")}</span><span className={styles.marqueeDot}>&bull;</span>
                  <span className={styles.marqueeItem}>{t("welcome.trust.isolated")}</span><span className={styles.marqueeDot}>&bull;</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="features">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>{t("welcome.features.eyebrow")}</span>
              <h2>{t("welcome.features.title")}</h2>
              <p>{t("welcome.features.sub")}</p>
            </div>

            <div className={styles.tabsShell}>
              <div className={styles.tabsNav}>
                {TAB_IDS.map((id) => {
                  const Icon = TAB_ICONS[id];
                  return (
                    <button key={id} className={cx(styles.tabBtn, activeTab === id && styles.tabBtnActive)} onClick={() => setActiveTab(id)}>
                      <span className={styles.tabIconWrap}><Icon size={18} /></span>
                      <span>
                        <strong>{t(`welcome.tabs.${id}.label`)}</strong>
                        <span className={styles.tabBtnSub}>{t(`welcome.tabs.${id}.sub`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={cx(styles.card, styles.tabPanel)}>
                <h3>{t(`welcome.panels.${activeTab}.title`)}</h3>
                <p>{t(`welcome.panels.${activeTab}.body`)}</p>
                <ul className={styles.pointList}>
                  <li><Check size={18} /> {t(`welcome.panels.${activeTab}.p1`)}</li>
                  <li><Check size={18} /> {t(`welcome.panels.${activeTab}.p2`)}</li>
                  <li><Check size={18} /> {t(`welcome.panels.${activeTab}.p3`)}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={cx(styles.section, styles.sectionTight)} id="channels">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>{t("welcome.ops.eyebrow")}</span>
              <h2>{t("welcome.ops.title")}</h2>
              <p>{t("welcome.ops.sub")}</p>
            </div>
            <div className={styles.grid3}>
              <div className={cx(styles.card, styles.featCard)}>
                <span className={styles.featIconWrap}><Inbox size={20} /></span>
                <h3>{t("welcome.ops.inbox.title")}</h3>
                <p>{t("welcome.ops.inbox.body")}</p>
              </div>
              <div className={cx(styles.card, styles.featCard)}>
                <span className={styles.featIconWrap}><Globe size={20} /></span>
                <h3>{t("welcome.ops.portals.title")}</h3>
                <p>{t("welcome.ops.portals.body")}</p>
              </div>
              <div className={cx(styles.card, styles.featCard)}>
                <span className={styles.featIconWrap}><Building2 size={20} /></span>
                <h3>{t("welcome.ops.whitelabel.title")}</h3>
                <p>{t("welcome.ops.whitelabel.body")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={cx(styles.section, styles.sectionTight)} id="open-source">
          <div className={styles.wrap}>
            <div className={cx(styles.darkPanel, styles.darkGrid)}>
              <div>
                <span className={styles.eyebrow}>{t("welcome.stack.eyebrow")}</span>
                <h2>{t("welcome.stack.title")}</h2>
                <p className={styles.darkPanelBody}>{t("welcome.stack.body")}</p>
                <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a className={cx(styles.btn, styles.btnPrimary)} href="https://openvoiss.com/docs/self-hosting">{t("welcome.stack.guideBtn")}</a>
                  <a className={cx(styles.btn, styles.btnDark)} href="https://openvoiss.com/docs/architecture">{t("welcome.stack.archBtn")}</a>
                </div>
              </div>
              <div className={styles.steps}>
                {(["step1", "step2", "step3"] as const).map((step, index) => (
                  <div className={styles.stepRow} key={step}>
                    <span className={styles.stepNum}>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{t(`welcome.stack.${step}.title`)}</strong><span>{t(`welcome.stack.${step}.body`)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={cx(styles.section, styles.sectionTight)} id="pricing">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>{t("welcome.plans.eyebrow")}</span>
              <h2>{t("welcome.plans.title")}</h2>
              <p>{t("welcome.plans.sub")}</p>
            </div>
            <div className={styles.grid2}>
              <div className={cx(styles.card, styles.planCard)}>
                <span className={cx(styles.planTag, styles.planTagLive)}>{t("welcome.plans.selfhost.tag")}</span>
                <div>
                  <h3>{t("welcome.plans.selfhost.title")}</h3>
                  <div className={styles.planPrice}>{t("welcome.plans.selfhost.price")}</div>
                </div>
                <p className={styles.planDesc}>{t("welcome.plans.selfhost.desc")}</p>
                <ul className={styles.planList}>
                  <li><Check size={16} /> {t("welcome.plans.selfhost.p1")}</li>
                  <li><Check size={16} /> {t("welcome.plans.selfhost.p2")}</li>
                  <li><Check size={16} /> {t("welcome.plans.selfhost.p3")}</li>
                </ul>
                <a className={cx(styles.btn, styles.btnPrimary, styles.planCta)} href="/login">{t("welcome.plans.selfhost.cta")}</a>
              </div>
              <div className={cx(styles.card, styles.planCard, styles.planCardCloud)}>
                <span className={cx(styles.planTag, styles.planTagSoon)}>{t("welcome.plans.cloud.tag")}</span>
                <div>
                  <h3>{t("welcome.plans.cloud.title")}</h3>
                  <div className={styles.planPrice}>{t("welcome.plans.cloud.price")}</div>
                  <div className={styles.planPriceDay}>{t("welcome.plans.cloud.perDay")}</div>
                </div>
                <p className={styles.planDesc}>{t("welcome.plans.cloud.desc")}</p>
                <ul className={styles.planList}>
                  <li><Check size={16} /> {t("welcome.plans.cloud.p1")}</li>
                  <li><Check size={16} /> {t("welcome.plans.cloud.p2")}</li>
                  <li><Check size={16} /> {t("welcome.plans.cloud.p3")}</li>
                  <li><Check size={16} /> {t("welcome.plans.cloud.p4")}</li>
                </ul>
                <a className={cx(styles.btn, styles.btnDark, styles.planCta)} href="https://github.com/kanazawa-dev/openvoiss/discussions">{t("welcome.plans.cloud.cta")}</a>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="faq">
          <div className={styles.wrap} style={{ maxWidth: 820 }}>
            <div className={styles.sectionHead} style={{ margin: "0 auto 36px" }}>
              <span className={styles.eyebrow}>{t("welcome.faq.eyebrow")}</span>
              <h2>{t("welcome.faq.title")}</h2>
            </div>
            {FAQ_IDS.map((id) => {
              const isOpen = openFaq.has(id);
              return (
                <div className={styles.faqItem} key={id}>
                  <button className={styles.faqQ} onClick={() => toggleFaq(id)}>
                    <strong>{t(`welcome.faq.q${id}` as "welcome.faq.q1")}</strong>
                    <ChevronDown size={20} className={cx(isOpen && styles.faqChevronOpen)} />
                  </button>
                  {isOpen && <div className={styles.faqA}>{t(`welcome.faq.a${id}` as "welcome.faq.a1")}</div>}
                </div>
              );
            })}
          </div>
        </section>

        <section className={cx(styles.section, styles.sectionTight)}>
          <div className={styles.wrap}>
            <div className={cx(styles.card, styles.ctaPanel)}>
              <h2>{t("welcome.cta.title")}</h2>
              <p>{t("welcome.cta.body")}</p>
              <div className={styles.ctaActions}>
                <a className={cx(styles.btn, styles.btnPrimary)} href="/login">{t("welcome.nav.getStarted")}</a>
                <a className={cx(styles.btn, styles.btnSecondary)} href="https://github.com/kanazawa-dev/openvoiss">{t("welcome.cta.star")}</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footTop}>
            <div className={styles.footBrand}>
              <img src="/brand/word-logo.png" alt="Openvoiss" />
              <p>{t("welcome.footer.blurb")}</p>
            </div>
            <div className={styles.footCols}>
              <div className={styles.footCol}>
                <strong>{t("welcome.footer.colProduct")}</strong>
                <a href="#features">{t("welcome.nav.features")}</a>
                <a href="#channels">{t("welcome.ops.eyebrow")}</a>
                <a href="#open-source">{t("welcome.nav.selfhost")}</a>
                <a href="#pricing">{t("welcome.nav.pricing")}</a>
              </div>
              <div className={styles.footCol}>
                <strong>{t("welcome.footer.colResources")}</strong>
                <a href="https://openvoiss.com/docs">{t("welcome.footer.docs")}</a>
                <a href="https://openvoiss.com/docs/getting-started">{t("welcome.footer.quickstart")}</a>
                <a href="https://github.com/kanazawa-dev/openvoiss/discussions">{t("welcome.footer.discussions")}</a>
              </div>
              <div className={styles.footCol}>
                <strong>{t("welcome.footer.colProject")}</strong>
                <a href="https://github.com/kanazawa-dev/openvoiss">GitHub</a>
                <a href="https://openvoiss.com/docs/contributing">{t("welcome.footer.contributing")}</a>
              </div>
            </div>
          </div>
          <div className={styles.footBottom}>
            <span>{t("welcome.footer.license")}</span>
            <span>{t("welcome.footer.tagline")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

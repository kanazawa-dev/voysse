"use client";

import Image from "next/image";
import { BloubAvatar } from "@/components/bloub-avatar";
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  Layers,
  MessageSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useLanguage, useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { CloudInterestDialog } from "@/components/cloud-interest-dialog";
import "./rivr.css";

const docs = "https://docs.voysse.cl/docs";
const github = "https://github.com/kanazawa-dev/voysse";

function Pill({
  href,
  children,
  light = false,
}: {
  href: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <a className={`rivr-pill${light ? " rivr-pill-light" : ""}`} href={href}>
      {children}
      <span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </span>
    </a>
  );
}

// Original cloud artwork: no video, autoplay, external request or animation loop.
function Scene({ variant }: { variant: "hero" | "cta" }) {
  return (
    <>
      <Image
        className="rivr-scene"
        src={`/media/voysse/cloud-connections-${variant === "hero" ? "day" : "night"}.png`}
        alt=""
        fill
        sizes="100vw"
        preload={variant === "hero"}
        quality={85}
      />
      <div className="rivr-scene-shade" aria-hidden="true" />
    </>
  );
}

export default function WelcomePage() {
  const t = useT();
  const { lang } = useLanguage();
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://app.voysse.cl"
  ).replace(/\/$/, "");
  const features = [
    { key: "agents", icon: Bot },
    { key: "knowledge", icon: Layers },
    { key: "tools", icon: Wrench },
    { key: "channels", icon: Radio },
  ] as const;
  return (
    <div className="rivr-landing">
      <a href="#main-content" className="rivr-skip">
        {lang === "es" ? "Ir al contenido" : "Skip to content"}
      </a>
      <main id="main-content">
        <section className="rivr-hero rivr-frame" id="top">
          <Scene variant="hero" />
          <nav
            className="rivr-nav"
            aria-label={
              lang === "es" ? "Navegación principal" : "Main navigation"
            }
          >
            <a href="#top" aria-label="Voysse">
              <OpenvoissBrand showName size={30} />
            </a>
            <div className="rivr-nav-links">
              <a href="#features">{t("welcome.nav.features")}</a>
              <a href="#channels">{t("welcome.nav.channels")}</a>
              <a href="#pricing">{t("welcome.nav.pricing")}</a>
              <a href={docs}>{t("welcome.nav.docs")}</a>
            </div>
            <div className="rivr-nav-actions">
              <LanguageSwitcher />

              <Pill href={`${appUrl}/login`}>
                {t("welcome.nav.getStarted")}
              </Pill>
            </div>
          </nav>
          <div className="rivr-mobile-links">
            <a href="#features">{t("welcome.nav.features")}</a>
            <a href="#pricing">{t("welcome.nav.pricing")}</a>
            <a href={docs}>{t("welcome.nav.docs")}</a>
          </div>
          <div className="rivr-hero-copy">
            <span className="rivr-eyebrow">
              <Sparkles size={15} />
              {t("welcome.hero.eyebrow")}
            </span>
            <h1>
              {t("welcome.hero.titleLine1")}
              <br />
              {t("welcome.hero.titleLine2")}
            </h1>
            <p>
              {lang === "es"
                ? "Crea agentes de IA, conecta tus canales y dale a cada cliente su propio espacio. Toda tu agencia, en un solo lugar."
                : "Build AI agents, connect your channels, and give every client a space of their own. Your entire agency, in one place."}
            </p>
          </div>
          <div className="rivr-glass-note">
            <div className="rivr-bloub-note">
              <BloubAvatar size={64} mood="idle" />
              <strong>Voxy</strong>
            </div>
            <small>
              {lang === "es" ? "Tu compañero de IA" : "Your AI companion"}
            </small>
            <a href={github}>
              <span>
                <ArrowUpRight size={16} />
              </span>
              GitHub
            </a>
          </div>
          <a className="rivr-doc-notch" href={docs}>
            <span>
              <BookOpen size={22} />
            </span>
            <div>
              <strong>{t("welcome.hero.readDocs")}</strong>
              <small>
                {t("welcome.footer.quickstart")} <ArrowUpRight size={13} />
              </small>
            </div>
          </a>
        </section>

        <section
          className="rivr-facts rivr-section"
          aria-label={t("welcome.features.eyebrow")}
        >
          {[
            ["01", t("welcome.ops.whitelabel.title")],
            ["02", "WhatsApp + Web"],
            ["03", "OpenAI · Anthropic"],
            ["FSL", t("welcome.trust.selfhost")],
          ].map(([value, label]) => (
            <div key={value}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className="rivr-section" id="features">
          <div className="rivr-section-head">
            <h2>{t("welcome.features.title")}</h2>
            <Pill href={`${appUrl}/login`}>{t("welcome.nav.getStarted")}</Pill>
          </div>
          <div className="rivr-bento">
            {features.map(({ key, icon: Icon }, i) => (
              <article className={`rivr-feature rivr-feature-${i}`} key={key}>
                <span className="rivr-icon">
                  <Icon size={24} />
                </span>
                {i === 0 && (
                  <div className="rivr-bloub-feature">
                    <BloubAvatar size={180} seed="agents" mood="listening" />
                  </div>
                )}
                <div>
                  <h3>{t(`welcome.panels.${key}.title`)}</h3>
                  <p>{t(`welcome.panels.${key}.body`)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rivr-section" id="channels">
          <div className="rivr-section-head">
            <div>
              <span className="rivr-kicker">{t("welcome.ops.eyebrow")}</span>
              <h2>{t("welcome.ops.title")}</h2>
            </div>
          </div>
          <div className="rivr-three">
            {(
              [
                { key: "inbox", icon: MessageSquare },
                { key: "portals", icon: ShieldCheck },
                { key: "whitelabel", icon: Layers },
              ] as const
            ).map(({ key, icon: Icon }) => (
              <article className="rivr-feature" key={key}>
                <span className="rivr-icon">
                  <Icon size={22} />
                </span>
                <h3>{t(`welcome.ops.${key}.title`)}</h3>
                <p>{t(`welcome.ops.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rivr-section rivr-stack" id="open-source">
          <div>
            <span className="rivr-kicker">{t("welcome.stack.eyebrow")}</span>
            <h2>{t("welcome.stack.title")}</h2>
            <p>{t("welcome.stack.body")}</p>
            <Pill href={`${docs}/self-hosting`}>
              {t("welcome.stack.guideBtn")}
            </Pill>
          </div>
          <div className="rivr-steps">
            {([1, 2, 3] as const).map((i) => (
              <article key={i}>
                <span>0{i}</span>
                <div>
                  <h3>{t(`welcome.stack.step${i}.title`)}</h3>
                  <p>{t(`welcome.stack.step${i}.body`)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rivr-section" id="pricing">
          <div className="rivr-section-head">
            <div>
              <span className="rivr-kicker">{t("welcome.plans.eyebrow")}</span>
              <h2>{t("welcome.plans.title")}</h2>
            </div>
          </div>
          <div className="rivr-three">
            {(["selfhost", "cloud", "enterprise"] as const).map((plan) => (
              <article
                className={`rivr-plan ${plan === "cloud" ? "rivr-plan-featured" : ""}`}
                key={plan}
              >
                <span className="rivr-kicker">
                  {t(`welcome.plans.${plan}.tag`)}
                </span>
                <h3>{t(`welcome.plans.${plan}.title`)}</h3>
                <strong className="rivr-price">
                  {t(`welcome.plans.${plan}.price`)}
                </strong>
                <p>{t(`welcome.plans.${plan}.desc`)}</p>
                <ul>
                  {([1, 2, 3, 4] as const).map((i) => (
                    <li key={i}>
                      <Check size={16} />
                      {t(`welcome.plans.${plan}.p${i}`)}
                    </li>
                  ))}
                </ul>
                {plan === "cloud" ? (
                  <CloudInterestDialog triggerClassName="rivr-cloud-button" />
                ) : (
                  <Pill
                    href={
                      plan === "selfhost"
                        ? `${docs}/getting-started`
                        : "mailto:ventas@voysse.cl"
                    }
                  >
                    {t(`welcome.plans.${plan}.cta`)}
                  </Pill>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="rivr-section" id="roadmap">
          <div className="rivr-section-head">
            <div>
              <span className="rivr-kicker">
                {t("welcome.roadmap.eyebrow")}
              </span>
              <h2>{t("welcome.roadmap.title")}</h2>
              <p>{t("welcome.roadmap.sub")}</p>
            </div>
            <Pill href={`${docs}/roadmap`}>{t("welcome.roadmap.cta")}</Pill>
          </div>
          <div className="rivr-roadmap">
            {(["channels", "voice", "ops", "platform"] as const).map((key) => (
              <article className="rivr-feature" key={key}>
                <h3>{t(`welcome.roadmap.${key}.title`)}</h3>
                <p>{t(`welcome.roadmap.${key}.desc`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rivr-section rivr-faq" id="faq">
          <span className="rivr-kicker">{t("welcome.faq.eyebrow")}</span>
          <h2>{t("welcome.faq.title")}</h2>
          {([1, 2, 3, 4, 5] as const).map((i) => (
            <details key={i}>
              <summary>
                {t(`welcome.faq.q${i}`)}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{t(`welcome.faq.a${i}`)}</p>
            </details>
          ))}
        </section>

        <section className="rivr-cta rivr-frame">
          <Scene variant="cta" />
          <div className="rivr-cta-copy">
            <div className="rivr-bloub-cta">
              <BloubAvatar
                size={88}
                mood="success"
                color="#e6efff"
                paper="#20365b"
              />
            </div>
            <h2>{t("welcome.cta.title")}</h2>
            <p>{t("welcome.cta.body")}</p>
            <div>
              <Pill href={`${appUrl}/login`} light>
                {t("welcome.nav.getStarted")}
              </Pill>
              <a className="rivr-cta-docs" href={docs}>
                {t("welcome.hero.readDocs")}
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="rivr-footer rivr-section">
        <div>
          <OpenvoissBrand showName size={30} />
          <p>{t("welcome.footer.blurb")}</p>
        </div>
        <nav aria-label={lang === "es" ? "Pie de página" : "Footer"}>
          <div>
            <strong>{t("welcome.footer.colProduct")}</strong>
            <a href="#features">{t("welcome.nav.features")}</a>
            <a href="#pricing">{t("welcome.nav.pricing")}</a>
            <a href="#open-source">{t("welcome.nav.selfhost")}</a>
          </div>
          <div>
            <strong>{t("welcome.footer.colResources")}</strong>
            <a href={docs}>{t("welcome.footer.docs")}</a>
            <a href={`${docs}/roadmap`}>{t("welcome.nav.roadmap")}</a>
            <a href="#faq">{t("welcome.nav.faq")}</a>
          </div>
          <div>
            <strong>{t("welcome.footer.colProject")}</strong>
            <a href={github}>GitHub</a>
            <a href="/privacy">{t("welcome.footer.privacy")}</a>
            <a href="/terms">{t("welcome.footer.terms")}</a>
          </div>
        </nav>
        <small>{t("welcome.footer.license")}</small>
      </footer>
    </div>
  );
}

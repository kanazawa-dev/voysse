"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Database,
  Github,
  Layers,
  Menu,
  MessageSquare,
  Radio,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { BloubAvatar } from "@/components/bloub-avatar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { CloudInterestDialog } from "@/components/cloud-interest-dialog";
import { useLanguage, useT } from "@/lib/i18n";
import "./cypon.css";

const docs = "https://docs.voysse.cl/docs";
const github = "https://github.com/kanazawa-dev/voysse";

function Action({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a
      className={`cy-action${secondary ? " cy-action-secondary" : ""}`}
      href={href}
    >
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}
function Section({
  id,
  number,
  name,
  badge,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  name: string;
  badge: string;
  title: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="cy-section">
      <div className="cy-index">
        [ {number} / 07 ] <span>·</span> {name}
      </div>
      <div className="cy-heading cy-corners">
        <span className="cy-tag">
          <i />
          {badge}
        </span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ProductPreview({ es }: { es: boolean }) {
  const text = (a: string, b: string) => (es ? a : b);
  return (
    <div className="cy-product-stage">
      <div className="cy-product-note">
        <span className="cy-live-dot" /> VOYSSE WORKSPACE{" "}
        <span>
          {text(
            "VISTA ILUSTRATIVA · DATOS DE EJEMPLO",
            "ILLUSTRATIVE PREVIEW · SAMPLE DATA",
          )}
        </span>
      </div>
      <div className="cy-dashboard">
        <aside className="cy-dash-sidebar">
          <div className="cy-workspace-mark">
            <span>v.</span> Studio Norte <ChevronDown size={13} />
          </div>
          <small>WORKSPACE</small>
          {[
            [Layers, text("Resumen", "Overview")],
            [MessageSquare, "Inbox"],
            [Bot, text("Agentes", "Agents")],
            [Radio, text("Canales", "Channels")],
            [Database, text("Conocimiento", "Knowledge")],
          ].map(([Icon, label], i) => {
            const I = Icon as typeof Layers;
            return (
              <div className={i === 1 ? "is-active" : ""} key={String(label)}>
                <I size={15} />
                {String(label)}
                {i === 1 && <em>3</em>}
              </div>
            );
          })}
          <div className="cy-dash-voxy">
            <BloubAvatar
              size={52}
              color="#a698ff"
              paper="#19191e"
              mood="listening"
            />
            <span>
              Voxy
              <small>{text("Tu compañero de IA", "Your AI companion")}</small>
            </span>
          </div>
        </aside>
        <div className="cy-dash-main">
          <header>
            <span>
              {text(
                "Tu operación, en un solo lugar",
                "Your operation, in one place",
              )}
            </span>
            <span className="cy-demo-label">
              DEMO <i />
            </span>
          </header>
          <div className="cy-dash-metrics">
            {[
              ["24", text("Conversaciones", "Conversations")],
              ["03", text("Agentes activos", "Active agents")],
              ["04", text("Canales", "Channels")],
            ].map(([value, label], i) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
                <svg viewBox="0 0 160 30" aria-hidden="true">
                  <path
                    d={`M0 26 L15 ${17 + i * 2} L28 21 L42 8 L56 19 L70 14 L85 18 L100 4 L114 11 L129 5 L145 9 L160 2`}
                    fill="none"
                    stroke="#a698ff"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            ))}
          </div>
          <div className="cy-dash-inbox">
            <div className="cy-threads">
              <strong>
                Inbox <span>03</span>
              </strong>
              {[
                [
                  "M",
                  "María González",
                  text("¿Puedo agendar una visita?", "Can I book a visit?"),
                ],
                [
                  "S",
                  "Santiago Pérez",
                  text(
                    "Gracias por la información",
                    "Thanks for the information",
                  ),
                ],
                [
                  "A",
                  "Ana Torres",
                  text("Quiero saber más", "I'd like to learn more"),
                ],
              ].map(([initial, name, message], i) => (
                <div key={name} className={i === 0 ? "selected" : ""}>
                  <b>{initial}</b>
                  <span>
                    {name}
                    <small>{message}</small>
                  </span>
                  <time>12:4{i}</time>
                </div>
              ))}
            </div>
            <div className="cy-chat">
              <header>
                <span>
                  <b>María González</b>
                  <small>
                    WhatsApp ·{" "}
                    {text("Atendido por tu agente", "Handled by your agent")}
                  </small>
                </span>
                <Bot size={16} />
              </header>
              <p className="cy-message cy-message-user">
                {text(
                  "Hola, ¿puedo agendar una visita para mañana?",
                  "Hi, can I book a visit for tomorrow?",
                )}
              </p>
              <p className="cy-message">
                {text(
                  "¡Hola María! Te ayudo a revisar las opciones. ¿Qué horario te acomoda?",
                  "Hi María! I can help you explore the options. What time works for you?",
                )}
              </p>
              <small className="cy-chat-source">
                <Database size={11} />
                {text(
                  "Respuesta con contexto de tu negocio",
                  "A reply with your business context",
                )}
              </small>
              <div className="cy-fake-composer">
                {text(
                  "Tu equipo puede tomar el control…",
                  "Your team can take over…",
                )}
                <ArrowRight size={15} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function MiniVisual({ type }: { type: number }) {
  return (
    <div className={`cy-mini cy-mini-${type}`} aria-hidden="true">
      {type === 0 ? (
        <>
          <div className="cy-mini-list">
            <span>
              <i /> AGENT / 01 <b>READY</b>
            </span>
            <span>
              <i /> AGENT / 02 <b>READY</b>
            </span>
            <span>
              <i /> AGENT / 03 <b>READY</b>
            </span>
          </div>
        </>
      ) : type === 1 ? (
        <div className="cy-mini-stack">
          <span>DOCUMENTS</span>
          <span>CONTEXT</span>
          <span>
            ANSWER <Sparkles size={12} />
          </span>
        </div>
      ) : type === 2 ? (
        <div className="cy-mini-flow">
          <Code2 />
          <span />
          <Bot />
          <span />
          <Check />
        </div>
      ) : (
        <div className="cy-pixel-grid">
          {Array.from({ length: 32 }, (_, i) => (
            <i key={i} style={{ opacity: (((i * 7) % 11) + 1) / 12 }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WelcomePage() {
  const { lang } = useLanguage();
  const t = useT();
  const es = lang === "es";
  const text = (a: string, b: string) => (es ? a : b);
  const [menuOpen, setMenuOpen] = useState(false);
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://app.voysse.cl"
  ).replace(/\/$/, "");
  const nav = [
    [
      text("Producto", "Product"),
      [
        ["#features", text("Agentes y conocimiento", "Agents & knowledge")],
        ["#channels", text("Canales", "Channels")],
      ],
    ],
    [
      text("Soluciones", "Solutions"),
      [
        ["#workspace", text("Para agencias", "For agencies")],
        ["#control", text("Control y privacidad", "Control & privacy")],
      ],
    ],
    [
      text("Recursos", "Resources"),
      [
        [docs, text("Documentación", "Documentation")],
        [github, "GitHub"],
        ["#faq", text("Preguntas frecuentes", "FAQ")],
      ],
    ],
  ] as const;
  return (
    <div className="cy-landing">
      <a href="#main-content" className="cy-skip">
        {text("Ir al contenido", "Skip to content")}
      </a>
      <header className="cy-nav-shell">
        <nav
          className="cy-nav"
          aria-label={text("Navegación principal", "Main navigation")}
        >
          <a className="cy-brand" href="#top" aria-label="Voysse">
            <OpenvoissBrand showName size={27} />
          </a>
          <div className={`cy-nav-links${menuOpen ? " is-open" : ""}`}>
            {nav.map(([label, links]) => (
              <details key={label} name="primary-navigation">
                <summary>
                  {label}
                  <ChevronDown size={12} />
                </summary>
                <div className="cy-nav-dropdown">
                  {links.map(([href, name]) => (
                    <a
                      key={href}
                      href={href}
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        setMenuOpen(false);
                      }}
                    >
                      {name}
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                </div>
              </details>
            ))}
            <a href="#pricing" onClick={() => setMenuOpen(false)}>
              {text("Planes", "Plans")}
            </a>
          </div>
          <div className="cy-nav-right">
            <a className="cy-github" href={github}>
              <Github size={15} /> GitHub
            </a>
            <LanguageSwitcher />
            <Action href={`${appUrl}/login`}>
              {text("Entrar", "Get started")}
            </Action>
            <button
              className="cy-menu-toggle"
              aria-expanded={menuOpen}
              aria-label={text("Abrir menú", "Open menu")}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </nav>
      </header>
      <main id="main-content">
        <div className="cy-stripe" />
        <section className="cy-hero cy-frame" id="top">
          <span className="cy-tag cy-tag-solid">
            <i />
            {text(
              "UNA PLATAFORMA. TODA TU AGENCIA.",
              "ONE PLATFORM. YOUR ENTIRE AGENCY.",
            )}
          </span>
          <h1>
            {text("Tu agencia, conectada.", "Your agency, connected.")}
            <br />
            {text("Tus agentes, con IA.", "Your agents, with AI.")}
          </h1>
          <p>
            {text(
              "Crea agentes de IA, conecta tus canales y dale a cada cliente su propio espacio. Menos tareas repetitivas. Más conversaciones que importan.",
              "Build AI agents, connect your channels, and give every client a space of their own. Less repetitive work. More conversations that matter.",
            )}
          </p>
          <div className="cy-actions">
            <Action href={`${appUrl}/login`}>
              {text("Abrir Voysse", "Open Voysse")}
            </Action>
            <Action href={docs} secondary>
              {text("Ver documentación", "Read the docs")}
            </Action>
          </div>
        </section>
        <div className="cy-stripe" />
        <div className="cy-frame">
          <ProductPreview es={es} />
          <div className="cy-provider-strip">
            <small>
              {text("TU STACK. TUS CLAVES.", "YOUR STACK. YOUR KEYS.")}
            </small>
            <span>OpenAI</span>
            <span>Anthropic</span>
            <span>Google</span>
            <span>Ollama</span>
            <span>OpenRouter</span>
          </div>
        </div>
        <Section
          id="overview"
          number="01"
          name={text("PLATAFORMA", "PLATFORM")}
          badge={text("DISEÑADA PARA AGENCIAS", "BUILT FOR AGENCIES")}
          title={
            <>
              {text("Más control.", "More control.")}
              <br />
              {text("Menos herramientas sueltas.", "Fewer disconnected tools.")}
            </>
          }
          description={text(
            "Un espacio para operar tus agentes, el conocimiento de tus clientes y las conversaciones de tu equipo.",
            "One space for your agents, your clients’ knowledge, and your team’s conversations.",
          )}
        >
          <div className="cy-facts">
            {[
              [
                "01",
                text("ESPACIO POR CLIENTE", "SPACE PER CLIENT"),
                text(
                  "Organiza agentes, canales y conocimiento sin mezclar operaciones.",
                  "Organize agents, channels and knowledge without mixing operations.",
                ),
              ],
              [
                "BYOK",
                text("TUS MODELOS, TUS CLAVES", "YOUR MODELS, YOUR KEYS"),
                text(
                  "Conecta tus proveedores de IA y mantén el control de tu consumo.",
                  "Connect AI providers and keep control of your usage.",
                ),
              ],
              [
                "AI + H",
                text("IA Y EQUIPO HUMANO", "AI AND HUMAN TEAM"),
                text(
                  "Toma el control de la conversación cuando haga falta.",
                  "Take over a conversation whenever you need to.",
                ),
              ],
              [
                "FSL",
                text("CÓDIGO DISPONIBLE", "SOURCE AVAILABLE"),
                text(
                  "Despliega en tu infraestructura bajo licencia FSL-1.1-MIT.",
                  "Deploy on your infrastructure under the FSL-1.1-MIT license.",
                ),
              ],
            ].map(([n, label, body]) => (
              <article key={n}>
                <strong>{n}</strong>
                <h3>{label}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </Section>
        <Section
          id="features"
          number="02"
          name={text("FUNCIONALIDADES", "CORE FEATURES")}
          badge={text("ASÍ FUNCIONA", "HOW IT WORKS")}
          title={
            <>
              {text("De una conversación", "From a conversation")}
              <br />
              {text("a una mejor operación.", "to a better operation.")}
            </>
          }
          description={text(
            "Agentes que conocen tu negocio, herramientas que conectan tus procesos y un equipo que conserva el control.",
            "Agents that know your business, tools that connect your processes, and a team that stays in control.",
          )}
        >
          <div className="cy-feature-grid">
            {(["agents", "knowledge", "tools", "channels"] as const).map(
              (key, i) => (
                <article key={key}>
                  <MiniVisual type={i} />
                  <h3>{t(`welcome.panels.${key}.title`)}</h3>
                  <p>{t(`welcome.panels.${key}.body`)}</p>
                </article>
              ),
            )}
          </div>
        </Section>
        <Section
          id="channels"
          number="03"
          name={text("CANALES Y MODELOS", "CHANNELS & MODELS")}
          badge={text("CONECTA TU OPERACIÓN", "CONNECT YOUR OPERATION")}
          title={
            <>
              {text("Donde están tus clientes.", "Where your customers are.")}
              <br />
              {text("Con tus propias reglas.", "On your own terms.")}
            </>
          }
          description={text(
            "Conecta tu stack sin perder de vista qué está disponible y qué requiere configuración.",
            "Connect your stack with a clear view of what is available and what needs setup.",
          )}
        >
          <div className="cy-integrations">
            {[
              [
                MessageSquare,
                "Web chat",
                text("Widget embebible", "Embeddable widget"),
              ],
              [Radio, "WhatsApp", text("Cloud API / QR", "Cloud API / QR")],
              [
                MessageSquare,
                "Instagram",
                text("Configuración manual · beta", "Manual setup · beta"),
              ],
              [
                MessageSquare,
                "Messenger",
                text("Configuración manual · beta", "Manual setup · beta"),
              ],
              [Sparkles, "OpenAI", "BYOK"],
              [Bot, "Anthropic", "BYOK"],
              [Code2, "Ollama", text("Modelos locales", "Local models")],
              [Workflow, "OpenRouter", "BYOK"],
            ].map(([Icon, label, status]) => {
              const I = Icon as typeof Bot;
              return (
                <div key={String(label)}>
                  <I size={27} />
                  <strong>{String(label)}</strong>
                  <small>{String(status)}</small>
                </div>
              );
            })}
          </div>
          <div className="cy-section-foot">
            <p>
              {text(
                "Meta requiere cuentas, permisos y validación del proveedor. No todos los canales tienen el mismo alcance.",
                "Meta requires accounts, permissions and provider validation. Channel capabilities differ.",
              )}
            </p>
            <a href={`${docs}/whatsapp`}>
              {text("Explorar canales", "Explore channels")}
              <ArrowRight size={15} />
            </a>
          </div>
        </Section>
        <Section
          id="workspace"
          number="04"
          name="WORKSPACE"
          badge={text("TU EQUIPO, CONECTADO", "YOUR TEAM, CONNECTED")}
          title={
            <>
              {text("Hecho para agencias.", "Made for agencies.")}
              <br />
              {text("Pensado para personas.", "Built around people.")}
            </>
          }
        >
          <div className="cy-work-grid">
            <article>
              <span className="cy-card-label">01 / INBOX</span>
              <h3>{t("welcome.ops.inbox.title")}</h3>
              <p>{t("welcome.ops.inbox.body")}</p>
              <div className="cy-inbox-mini">
                <span>
                  <i /> {text("Nueva conversación", "New conversation")}{" "}
                  <b>AI</b>
                </span>
                <span>
                  <i />
                  {text("Requiere revisión", "Needs review")}
                  <b>HUMAN</b>
                </span>
                <span>
                  <i />
                  {text("Respuesta confirmada", "Reply confirmed")}
                  <Check size={13} />
                </span>
              </div>
            </article>
            <article>
              <div className="cy-voxy-card">
                <BloubAvatar
                  size={100}
                  seed="cypon-voxy"
                  color="#5135ff"
                  paper="#f4f4f5"
                  mood="listening"
                />
                <span>
                  Voxy
                  <small>
                    {text("Tu compañero de IA", "Your AI companion")}
                  </small>
                </span>
              </div>
              <h3>
                {text(
                  "Tecnología que te acompaña.",
                  "Technology that stays with you.",
                )}
              </h3>
              <p>
                {text(
                  "Una presencia familiar mientras configuras agentes y das forma a tu operación.",
                  "A familiar presence while you configure agents and shape your operation.",
                )}
              </p>
            </article>
            {(["portals", "whitelabel"] as const).map((key, i) => (
              <article key={key}>
                <span className="cy-card-label">
                  0{i + 3} / {key.toUpperCase()}
                </span>
                <h3>{t(`welcome.ops.${key}.title`)}</h3>
                <p>{t(`welcome.ops.${key}.body`)}</p>
                <div className="cy-label-row">
                  {(i
                    ? ["BRAND", "CLIENT", "WORKSPACE"]
                    : ["ADMIN", "OPERATOR", "PORTAL"]
                  ).map((x) => (
                    <span key={x}>
                      {x}
                      <Check size={12} />
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
        <Section
          id="control"
          number="05"
          name={text("CONTROL", "CONTROL")}
          badge={text("SIN CAJAS NEGRAS", "NO BLACK BOXES")}
          title={
            <>
              {text("Tus datos. Tu contexto.", "Your data. Your context.")}
              <br />
              {text("Tu forma de trabajar.", "Your way of working.")}
            </>
          }
        >
          <div className="cy-comparison">
            <div>
              <header>
                {text("Herramientas desconectadas", "Disconnected tools")}
              </header>
              {[
                text("Conversaciones repartidas", "Scattered conversations"),
                text(
                  "Configuración repetida por cliente",
                  "Repeated setup per client",
                ),
                text("Respuestas sin contexto", "Replies without context"),
                text("Errores sin seguimiento", "Errors without follow-up"),
              ].map((x) => (
                <p key={x}>
                  <span>—</span>
                  {x}
                </p>
              ))}
            </div>
            <div>
              <header>
                <OpenvoissBrand size={20} showName />
              </header>
              {[
                text("Inbox para tu operación", "An inbox for your operation"),
                text(
                  "Espacios y agentes por cliente",
                  "Client workspaces and agents",
                ),
                text(
                  "Conocimiento conectado a tus agentes",
                  "Knowledge connected to your agents",
                ),
                text(
                  "Intentos y estados de envío visibles",
                  "Visible attempts and send states",
                ),
              ].map((x) => (
                <p key={x}>
                  <Check size={15} />
                  {x}
                </p>
              ))}
            </div>
          </div>
        </Section>
        <Section
          id="pricing"
          number="06"
          name={text("PLANES", "PRICING")}
          badge={text("EMPIEZA A TU MANERA", "START YOUR WAY")}
          title={
            <>
              {text("Tu siguiente etapa,", "Your next stage,")}
              <br />
              {text(
                "sin cambiar de plataforma.",
                "without changing platforms.",
              )}
            </>
          }
        >
          <div className="cy-plans">
            {(["selfhost", "cloud", "enterprise"] as const).map((plan) => (
              <article
                key={plan}
                className={plan === "cloud" ? "cy-plan-featured" : ""}
              >
                <span className="cy-card-label">
                  {t(`welcome.plans.${plan}.tag`)}
                </span>
                <h3>{t(`welcome.plans.${plan}.title`)}</h3>
                <p>{t(`welcome.plans.${plan}.desc`)}</p>
                <strong className="cy-price">
                  {t(`welcome.plans.${plan}.price`)}
                </strong>
                {plan === "cloud" ? (
                  <CloudInterestDialog triggerClassName="cy-action cy-cloud-trigger" />
                ) : (
                  <Action
                    href={
                      plan === "selfhost"
                        ? `${docs}/getting-started`
                        : "mailto:ventas@voysse.cl"
                    }
                    secondary
                  >
                    {t(`welcome.plans.${plan}.cta`)}
                  </Action>
                )}
                <ul>
                  {([1, 2, 3, 4] as const).map((i) => (
                    <li key={i}>
                      <Check size={14} />
                      {t(`welcome.plans.${plan}.p${i}`)}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>
        <Section
          id="faq"
          number="07"
          name="FAQ"
          badge={text("ANTES DE EMPEZAR", "BEFORE YOU START")}
          title={
            <>
              {text("Buenas preguntas.", "Good questions.")}
              <br />
              {text("Respuestas claras.", "Clear answers.")}
            </>
          }
        >
          <div className="cy-faq">
            {([1, 2, 3, 4, 5] as const).map((i) => (
              <details key={i}>
                <summary>
                  {t(`welcome.faq.q${i}`)}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{t(`welcome.faq.a${i}`)}</p>
              </details>
            ))}
          </div>
        </Section>
        <section className="cy-cta cy-frame cy-corners">
          <span className="cy-tag">
            <i /> {text("TU PRÓXIMO PASO", "YOUR NEXT STEP")}
          </span>
          <h2>
            {text("Menos fricción.", "Less friction.")}
            <br />
            {text("Más posibilidades.", "More possibilities.")}
          </h2>
          <p>
            {text(
              "Dale a tu agencia un espacio para crecer con IA.",
              "Give your agency a space to grow with AI.",
            )}
          </p>
          <div className="cy-actions">
            <Action href={`${appUrl}/login`}>
              {text("Abrir Voysse", "Open Voysse")}
            </Action>
            <Action href={docs} secondary>
              {text("Ver documentación", "Read the docs")}
            </Action>
          </div>
          <div className="cy-dot-wave" aria-hidden="true" />
        </section>
      </main>
      <footer className="cy-footer cy-frame">
        <div>
          <OpenvoissBrand size={28} showName />
          <p>{t("welcome.footer.blurb")}</p>
          <a href={github}>
            <Github size={17} /> GitHub <ArrowUpRight size={13} />
          </a>
        </div>
        <div>
          <strong>{text("PRODUCTO", "PRODUCT")}</strong>
          <a href="#features">{t("welcome.nav.features")}</a>
          <a href="#channels">{t("welcome.nav.channels")}</a>
          <a href="#pricing">{t("welcome.nav.pricing")}</a>
        </div>
        <div>
          <strong>{text("RECURSOS", "RESOURCES")}</strong>
          <a href={docs}>{t("welcome.footer.docs")}</a>
          <a href={`${docs}/roadmap`}>Roadmap</a>
          <a href="#faq">FAQ</a>
        </div>
        <div>
          <strong>{text("PROYECTO", "PROJECT")}</strong>
          <a href="/privacy">{t("welcome.footer.privacy")}</a>
          <a href="/terms">{t("welcome.footer.terms")}</a>
          <a href="mailto:ventas@voysse.cl">{text("Contacto", "Contact")}</a>
        </div>
        <div className="cy-footer-bottom">
          <span>{t("welcome.footer.license")}</span>
          <span>
            <i className="cy-live-dot" /> SOURCE AVAILABLE / BUILT FOR AGENCIES
          </span>
        </div>
      </footer>
    </div>
  );
}

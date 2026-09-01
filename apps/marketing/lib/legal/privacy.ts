// Content for /privacy. This is an AI-drafted starting point, not legal
// advice -- have it reviewed by a lawyer before treating it as final,
// especially given Chile's transition from Ley 19.628 to Ley 21.719.
export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDoc = { updated: string; notice: string; sections: LegalSection[] };

const CONTACT_EMAIL = "alex@voysse.cl";
const CONTACT_PHONE = "+56 9 4095 6827";

export const privacy: { es: LegalDoc; en: LegalDoc } = {
  es: {
    updated: "31 de agosto de 2026",
    notice:
      "Este documento es un borrador redactado como punto de partida y no constituye asesoría legal. Chile está en transición entre la Ley N.º 19.628 y la nueva Ley N.º 21.719 de Protección de Datos Personales -- recomendamos revisión de un abogado antes de considerarlo definitivo.",
    sections: [
      {
        heading: "1. Quiénes somos",
        paragraphs: [
          "Voysse (\"nosotros\", \"la plataforma\") es la marca bajo la que operamos el sitio voysse.cl y el servicio hosteado Voysse Cloud, con domicilio en Chile.",
          `Puedes contactarnos por correo a ${CONTACT_EMAIL} o por teléfono al ${CONTACT_PHONE}.`,
        ],
      },
      {
        heading: "2. A qué aplica esta política",
        paragraphs: [
          "Esta política cubre el sitio web, el servicio hosteado Voysse Cloud y el panel de administración interno.",
          "No aplica a instancias auto-hospedadas (self-hosted) de Voysse: si tu agencia instala el código abierto en su propia infraestructura, ustedes son responsables del tratamiento de esos datos, no nosotros. Voysse no tiene acceso a esas instalaciones.",
        ],
      },
      {
        heading: "3. Qué datos recopilamos",
        paragraphs: [
          "Datos de cuenta: al registrar tu agencia guardamos tu nombre, correo electrónico y una contraseña, siempre almacenada con hash, nunca en texto plano.",
          "Datos de tus clientes: la información que cargas sobre cada cliente (nombre, industria, descripción, contexto de negocio) para configurar sus agentes de IA.",
          "Conversaciones: los mensajes que los usuarios finales de tus clientes intercambian con tus agentes por WhatsApp o chat web, incluyendo audio o imágenes si activas esas funciones.",
          "Claves de proveedores de IA: si conectas tu propia clave de OpenAI o Anthropic, la guardamos encriptada. Nunca se muestra completa ni se usa para otro fin que ejecutar tus propios agentes.",
          "Leads de Voysse Cloud: si dejas tus datos en el formulario \"Elegir Cloud\" del sitio, guardamos tu nombre, correo y el nombre de tu agencia para poder contactarte.",
          "Cookies técnicas: usamos cookies de sesión (httpOnly) estrictamente necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de rastreo de terceros.",
          "Datos técnicos: dirección IP y metadatos de solicitudes, usados solo por seguridad y para limitar abuso.",
        ],
      },
      {
        heading: "4. Para qué usamos tus datos",
        paragraphs: [
          "Para prestar el servicio: crear y operar tus agentes, los portales de tus clientes y los canales de WhatsApp o web que conectes.",
          "Para activar y administrar tu cuenta de Voysse Cloud.",
          "Por seguridad: prevenir accesos no autorizados, abuso o spam.",
          "Para comunicarnos contigo sobre tu cuenta o tu solicitud.",
          "Para cumplir obligaciones legales que nos apliquen.",
        ],
      },
      {
        heading: "5. Con quién compartimos datos",
        paragraphs: [
          "Proveedores de IA (OpenAI, Anthropic): las conversaciones se envían a estos proveedores usando tu propia clave, no una compartida por Voysse -- su tratamiento de esos datos se rige por las políticas propias de cada proveedor.",
          "Meta / WhatsApp: si activas el canal de WhatsApp Cloud API, los mensajes pasan por la infraestructura de Meta bajo sus propios términos.",
          "Proveedores de infraestructura: alojamos la plataforma en servidores de terceros (actualmente Railway), que pueden estar ubicados fuera de Chile.",
          "Nunca vendemos tus datos ni los de tus clientes a terceros con fines publicitarios.",
        ],
      },
      {
        heading: "6. Transferencia internacional de datos",
        paragraphs: [
          "Como usamos proveedores de infraestructura internacionales, tus datos pueden procesarse fuera de Chile. Tomamos medidas razonables -- encriptación en tránsito y en reposo -- para protegerlos igualmente.",
        ],
      },
      {
        heading: "7. Cuánto tiempo guardamos los datos",
        paragraphs: [
          "Mientras tu cuenta esté activa. Si tu cuenta es eliminada o das de baja el servicio, eliminamos o anonimizamos los datos dentro de un plazo razonable, salvo que la ley nos obligue a conservar algo por más tiempo.",
        ],
      },
      {
        heading: "8. Seguridad",
        paragraphs: [
          "Las claves de proveedores de IA y las sesiones de WhatsApp se guardan encriptadas. Las contraseñas se guardan con hash. Las cookies de sesión son httpOnly. Ningún sistema es infalible, pero tomamos medidas razonables acordes al estándar de la industria.",
        ],
      },
      {
        heading: "9. Tus derechos",
        paragraphs: [
          "Conforme a la Ley N.º 19.628 sobre Protección de la Vida Privada -- y a la Ley N.º 21.719 una vez entre en vigencia -- tienes derecho a acceder, rectificar, cancelar u oponerte al tratamiento de tus datos personales.",
          `Para ejercer estos derechos, escríbenos a ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: "10. Datos de menores de edad",
        paragraphs: [
          "Voysse no está dirigido a menores de edad y no recopilamos intencionalmente datos de menores de 18 años.",
        ],
      },
      {
        heading: "11. Cambios a esta política",
        paragraphs: [
          "Podemos actualizar esta política. Si el cambio es significativo, te avisaremos por correo o mediante un aviso visible en el sitio.",
        ],
      },
      {
        heading: "12. Contacto",
        paragraphs: [`${CONTACT_EMAIL} · ${CONTACT_PHONE}`],
      },
    ],
  },
  en: {
    updated: "August 31, 2026",
    notice:
      "This document is an AI-drafted starting point, not legal advice. Chile is transitioning from Law 19.628 to the new Law 21.719 on Personal Data Protection -- have it reviewed by a lawyer before treating it as final. In case of any conflict between this English version and the Spanish version, the Spanish version governs.",
    sections: [
      {
        heading: "1. Who we are",
        paragraphs: [
          "Voysse (\"we\", \"the platform\") is the brand under which we operate voysse.cl and the hosted Voysse Cloud service, based in Chile.",
          `You can reach us by email at ${CONTACT_EMAIL} or by phone at ${CONTACT_PHONE}.`,
        ],
      },
      {
        heading: "2. What this policy covers",
        paragraphs: [
          "This policy covers the website, the hosted Voysse Cloud service, and the internal admin panel.",
          "It does not cover self-hosted Voysse instances: if your agency installs the open-source code on your own infrastructure, you are the data controller for that data, not us. Voysse has no access to those installations.",
        ],
      },
      {
        heading: "3. What data we collect",
        paragraphs: [
          "Account data: when you register your agency, we store your name, email address and a password, always stored hashed, never in plain text.",
          "Your clients' data: whatever you enter about each client (name, industry, description, business context) to configure their AI agents.",
          "Conversations: the messages your clients' end users exchange with your agents over WhatsApp or web chat, including audio or images if you enable those capabilities.",
          "AI provider keys: if you connect your own OpenAI or Anthropic key, we store it encrypted. It's never shown in full and is never used for anything other than running your own agents.",
          "Voysse Cloud leads: if you leave your details in the \"Choose Cloud\" form on the site, we store your name, email and agency name so we can reach out.",
          "Technical cookies: we use strictly necessary, httpOnly session cookies to keep you signed in. We do not use advertising or third-party tracking cookies.",
          "Technical data: IP address and request metadata, used only for security and abuse prevention.",
        ],
      },
      {
        heading: "4. What we use your data for",
        paragraphs: [
          "To provide the service: creating and running your agents, your clients' portals, and any WhatsApp or web channels you connect.",
          "To activate and manage your Voysse Cloud account.",
          "For security: preventing unauthorized access, abuse or spam.",
          "To communicate with you about your account or request.",
          "To comply with legal obligations that apply to us.",
        ],
      },
      {
        heading: "5. Who we share data with",
        paragraphs: [
          "AI providers (OpenAI, Anthropic): conversations are sent to these providers using your own key, never a key shared by Voysse -- their handling of that data is governed by their own policies.",
          "Meta / WhatsApp: if you enable the WhatsApp Cloud API channel, messages pass through Meta's infrastructure under their own terms.",
          "Infrastructure providers: we host the platform on third-party servers (currently Railway), which may be located outside Chile.",
          "We never sell your data or your clients' data to third parties for advertising purposes.",
        ],
      },
      {
        heading: "6. International data transfers",
        paragraphs: [
          "Because we use international infrastructure providers, your data may be processed outside Chile. We take reasonable measures -- encryption in transit and at rest -- to protect it just the same.",
        ],
      },
      {
        heading: "7. How long we keep data",
        paragraphs: [
          "For as long as your account is active. If your account is deleted or you stop using the service, we delete or anonymize the data within a reasonable period, unless the law requires us to keep something longer.",
        ],
      },
      {
        heading: "8. Security",
        paragraphs: [
          "AI provider keys and WhatsApp sessions are stored encrypted. Passwords are stored hashed. Session cookies are httpOnly. No system is foolproof, but we take reasonable, industry-standard measures.",
        ],
      },
      {
        heading: "9. Your rights",
        paragraphs: [
          "Under Chile's Law 19.628 on the Protection of Private Life -- and Law 21.719 once it takes effect -- you have the right to access, rectify, cancel or object to the processing of your personal data.",
          `To exercise these rights, write to us at ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: "10. Children's data",
        paragraphs: [
          "Voysse is not directed at minors and we do not knowingly collect data from anyone under 18.",
        ],
      },
      {
        heading: "11. Changes to this policy",
        paragraphs: [
          "We may update this policy. If a change is significant, we'll let you know by email or with a visible notice on the site.",
        ],
      },
      {
        heading: "12. Contact",
        paragraphs: [`${CONTACT_EMAIL} · ${CONTACT_PHONE}`],
      },
    ],
  },
};

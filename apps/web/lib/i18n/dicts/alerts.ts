// UI strings for the agency-facing alerts bell (WhatsApp drops, failed
// knowledge documents). Not the Voysse team's /admin panel.
const en = {
  bell: "Alerts",
  empty: "Nothing needs your attention.",
  resolve: "Dismiss",
  resolving: "Dismissing…",
  seeAll: "View resolved",
  types: {
    whatsapp_error: "WhatsApp",
    whatsapp_cloud_error: "WhatsApp API",
    knowledge_document_error: "Knowledge base",
  },
};

const es: typeof en = {
  bell: "Alertas",
  empty: "Nada que requiera tu atención.",
  resolve: "Descartar",
  resolving: "Descartando…",
  seeAll: "Ver resueltas",
  types: {
    whatsapp_error: "WhatsApp",
    whatsapp_cloud_error: "WhatsApp API",
    knowledge_document_error: "Base de conocimiento",
  },
};

export const alerts = { en, es };

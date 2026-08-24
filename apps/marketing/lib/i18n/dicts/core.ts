// Trimmed copy of apps/web's core dict: only the namespaces this app's single
// page actually uses (nav labels for the hero's dashboard mock, and the
// language switcher's aria-label) — not the full dashboard core dict.
const en = {
  nav: {
    home: "Home",
    clients: "Clients",
    agents: "Agents",
    playground: "Playground",
    inbox: "Inbox",
    channels: "Channels",
    settings: "Settings",
  },
  shell: {
    language: "Language",
  },
};

const es: typeof en = {
  nav: {
    home: "Inicio",
    clients: "Clientes",
    agents: "Agentes",
    playground: "Playground",
    inbox: "Inbox",
    channels: "Canales",
    settings: "Configuración",
  },
  shell: {
    language: "Idioma",
  },
};

export const core = { en, es };

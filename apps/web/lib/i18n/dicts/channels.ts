// UI strings for the "channels" area. Fill `en` and mirror it in `es`.
const en = {
  head: {
    eyebrow: "Channels",
    title: "Channels",
    description: "Connect each client's number to its own agent and Inbox.",
  },
  toolbar: {
    clientLabel: "Client",
    allClients: "All clients",
    openClient: "Open client",
  },
  whatsappCloud: {
    status: "Available",
    title: "WhatsApp API",
    description:
      "Official WhatsApp Business Cloud API, hosted by Meta. Connect a number with your own Meta app credentials.",
    ownerPlaceholder: "Choose a client to configure its number",
    configure: "Configure WhatsApp API",
    selectClient: "Select a client",
  },
  whatsapp: {
    status: "Available",
    title: "WhatsApp QR",
    description:
      "Scan a QR with the WhatsApp app on your phone, reply with an agent, and let the team take over from the Inbox.",
    ownerPlaceholder: "Choose a client to configure its number",
    configure: "Configure WhatsApp QR",
    selectClient: "Select a client",
  },
  future: {
    comingSoon: "Coming soon",
    manualStatus: "Manual setup · validation",
    manualHint: "Requires your Meta credentials and permissions; guided OAuth is not available yet.",
    webchatStatus: "Available",
    ownerPlaceholder: "Configurable inside each client",
    connect: "Connect channel",
    instagram: {
      name: "Instagram",
      description: "Reply to direct messages with the knowledge of your agents.",
    },
    facebook: {
      name: "Facebook Messenger",
      description: "Connect your pages and keep consistent support.",
    },
    webchat: {
      name: "Webchat",
      description: "Embed an assistant on any website with a single line of code.",
    },
  },
  note: {
    strong: "Each connection belongs to a single client.",
    rest: "Its number, agent, session, and conversations stay separate from other spaces.",
  },
};

const es: typeof en = {
  head: {
    eyebrow: "Canales",
    title: "Canales",
    description: "Conecta el número de cada cliente con su propio agente e Inbox.",
  },
  toolbar: {
    clientLabel: "Cliente",
    allClients: "Todos los clientes",
    openClient: "Abrir cliente",
  },
  whatsappCloud: {
    status: "Disponible",
    title: "WhatsApp API",
    description:
      "API oficial de WhatsApp Business Cloud, alojada por Meta. Conecta un número con las credenciales de tu propia app de Meta.",
    ownerPlaceholder: "Elige un cliente para configurar su número",
    configure: "Configurar WhatsApp API",
    selectClient: "Selecciona un cliente",
  },
  whatsapp: {
    status: "Disponible",
    title: "WhatsApp QR",
    description:
      "Escanea un QR con la app de WhatsApp de tu teléfono, responde con un agente y permite que el equipo tome el control desde el Inbox.",
    ownerPlaceholder: "Elige un cliente para configurar su número",
    configure: "Configurar WhatsApp QR",
    selectClient: "Selecciona un cliente",
  },
  future: {
    comingSoon: "Próximamente",
    manualStatus: "Configuración manual · validación",
    manualHint: "Requiere credenciales y permisos de Meta; la conexión guiada por OAuth aún no está disponible.",
    webchatStatus: "Disponible",
    ownerPlaceholder: "Configurable dentro de cada cliente",
    connect: "Conectar canal",
    instagram: {
      name: "Instagram",
      description: "Responde mensajes directos con el conocimiento de tus agentes.",
    },
    facebook: {
      name: "Facebook Messenger",
      description: "Conecta tus páginas y mantén una atención consistente.",
    },
    webchat: {
      name: "Webchat",
      description: "Inserta un asistente en cualquier sitio web con una línea de código.",
    },
  },
  note: {
    strong: "Cada conexión pertenece a un solo cliente.",
    rest: "Su número, agente, sesión y conversaciones permanecen separados de los demás espacios.",
  },
};

export const channels = { en, es };

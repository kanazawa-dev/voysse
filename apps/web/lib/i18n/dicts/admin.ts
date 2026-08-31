// UI strings for the internal /admin panel (Voysse team only, not agencies).
const en = {
  login: {
    eyebrow: "Voysse team",
    title: "Admin sign in",
    subtitle: "Internal access for the Voysse team only.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
  },
  head: {
    eyebrow: "Voysse team",
    title: "Admin",
    description: "Cloud leads and agency access, for the Voysse team only.",
  },
  logout: "Sign out",
  tabs: {
    leads: "Cloud leads",
    agencies: "Agencies",
  },
  leads: {
    empty: "No Cloud interest submissions yet.",
    emptyDesc: "Submissions from the landing page's \"Choose Cloud\" form show up here.",
    thName: "Name",
    thEmail: "Email",
    thAgency: "Agency",
    thDate: "Date",
  },
  agencies: {
    empty: "No agencies yet.",
    emptyDesc: "Agencies that register show up here.",
    thName: "Agency",
    thOwner: "Owner",
    thUsers: "Users",
    thClients: "Clients",
    thStatus: "Status",
    thCreated: "Created",
    thAction: "",
    active: "Active",
    inactive: "Inactive",
    deactivate: "Deactivate",
    activate: "Activate",
    confirmDeactivate: "Deactivate {name}? Its users will be signed out and won't be able to log back in until you activate it again.",
  },
};

const es: typeof en = {
  login: {
    eyebrow: "Equipo Voysse",
    title: "Acceso de administración",
    subtitle: "Acceso interno, solo para el equipo Voysse.",
    email: "Correo electrónico",
    password: "Contraseña",
    submit: "Entrar",
  },
  head: {
    eyebrow: "Equipo Voysse",
    title: "Admin",
    description: "Leads de Cloud y acceso de agencias, solo para el equipo Voysse.",
  },
  logout: "Cerrar sesión",
  tabs: {
    leads: "Leads de Cloud",
    agencies: "Agencias",
  },
  leads: {
    empty: "Todavía no hay leads de Cloud.",
    emptyDesc: "Los envíos del formulario \"Elegir Cloud\" de la landing aparecen acá.",
    thName: "Nombre",
    thEmail: "Correo",
    thAgency: "Agencia",
    thDate: "Fecha",
  },
  agencies: {
    empty: "Todavía no hay agencias.",
    emptyDesc: "Las agencias que se registren aparecen acá.",
    thName: "Agencia",
    thOwner: "Dueño",
    thUsers: "Usuarios",
    thClients: "Clientes",
    thStatus: "Estado",
    thCreated: "Creada",
    thAction: "",
    active: "Activa",
    inactive: "Inactiva",
    deactivate: "Desactivar",
    activate: "Activar",
    confirmDeactivate: "¿Desactivar {name}? Sus usuarios quedarán desconectados y no podrán volver a entrar hasta que la actives de nuevo.",
  },
};

export const admin = { en, es };

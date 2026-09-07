export const onboardingCopy = {
  es: {
    label: 'Primeros pasos', resume: 'Retomar recorrido', repeat: 'Repetir recorrido', later: 'Ahora no', back: 'Atrás', next: 'Siguiente', finish: 'Terminar recorrido', action: 'Abrir configuración', retry: 'Recargar progreso', progress: 'Paso', of: 'de',
    note: 'Puedes salir y retomar desde Primeros pasos. Completar el recorrido no activa canales ni significa que la configuración esté terminada.',
    steps: [
      ['Tu espacio, paso a paso', 'Soy Voxy. Tu agencia reúne a tus clientes; cada cliente tiene sus agentes, conocimiento y conversaciones. Vamos con lo esencial, sin configurar todo de una vez.', ''],
      ['Dale identidad y conecta tu IA', 'En Configuración, agrega el nombre y color de tu agencia y guarda tu clave en Proveedores IA. La clave no se comparte con clientes. Las pruebas consumen saldo del proveedor.', '/settings'],
      ['Crea tu primer cliente', 'Un cliente representa un negocio. Añade su nombre, rubro y contexto: qué ofrece, a quién atiende y qué información no debe inventar el agente.', '/clients/new'],
      ['Prepara un agente útil', 'Elige el cliente, proveedor y modelo. Define una tarea concreta. Después de guardarlo, abre su ficha para añadir documentos y preguntas frecuentes antes de probarlo.', '/agents/new'],
      ['Prueba antes de conectar', 'En Playground, pregunta algo conocido, algo que no esté en los documentos y solicita atención humana. Revisa respuestas y consumo. Prueba sin conectar canales externos.', '/playground'],
      ['Ordena tu Studio', 'Abre el canvas de un cliente para configurar agentes y revisar conexiones. Chat web es opcional; los canales necesitan configuración propia. Publicar reglas todavía no activa derivaciones reales.', '/studio'],
      ['Acompaña la conversación', 'Inbox reúne las conversaciones. El modo humano permite intervenir. El portal de cada cliente se configura desde Clientes; úsalo para compartir acceso sin dar acceso a toda la agencia.', '/inbox'],
      ['Empieza pequeño', 'Conecta un solo canal cuando hayas probado respuestas, permisos y costes. Revisa el portal desde la ficha del cliente. Puedes repetir este recorrido cuando quieras.', '/clients'],
    ],
    operator: [
      ['Bienvenido a tu Inbox', 'Soy Voxy. Tu rol es acompañar conversaciones. La configuración de clientes, agentes y proveedores corresponde a un administrador.', ''],
      ['Atiende con contexto', 'Abre una conversación, revisa su historial y cambia a modo humano antes de responder. No prometas acciones que el negocio no haya confirmado.', '/inbox'],
      ['Mantén al equipo al tanto', 'Verifica el estado de entrega antes de reintentar un mensaje. Si falta un canal o necesitas cambiar el agente, pide ayuda a un administrador.', '/inbox'],
    ],
  },
  en: {
    label: 'Getting started', resume: 'Resume tour', repeat: 'Repeat tour', later: 'Not now', back: 'Back', next: 'Next', finish: 'Finish tour', action: 'Open setup', retry: 'Reload progress', progress: 'Step', of: 'of',
    note: 'Leave and resume from Getting started. Finishing the tour does not activate channels or mean setup is complete.',
    steps: [
      ['Your workspace, one step at a time', 'I’m Voxy. Your agency brings clients together; each client has agents, knowledge and conversations. Start with the essentials rather than configuring everything at once.', ''],
      ['Add your identity and AI', 'In Settings, add your agency name and color, then save your key under AI providers. Clients do not receive this key. Tests use your provider balance.', '/settings'],
      ['Create your first client', 'A client represents a business. Add its name, industry and context: what it offers, who it serves and what the agent must never invent.', '/clients/new'],
      ['Prepare a useful agent', 'Choose the client, provider and model. Give the agent one clear task. After saving, open its details to add documents and FAQs before testing.', '/agents/new'],
      ['Test before connecting', 'In Playground, ask something known, something missing from the documents, and request human help. Review answers and usage before connecting external channels.', '/playground'],
      ['Arrange your Studio', 'Open a client canvas to configure agents and inspect connections. Web chat is optional; channels need their own setup. Publishing rules does not yet activate live handoffs.', '/studio'],
      ['Support the conversation', 'Inbox brings conversations together. Human mode lets you step in. Configure each client portal from Clients to share access without exposing the whole agency.', '/inbox'],
      ['Start small', 'Connect one channel after testing answers, permissions and costs. Review the portal from the client details. You can repeat this tour at any time.', '/clients'],
    ],
    operator: [
      ['Welcome to your Inbox', 'I’m Voxy. Your role is to support conversations. An administrator manages clients, agents and provider settings.', ''],
      ['Respond with context', 'Open a conversation, read its history and switch to human mode before replying. Never promise actions the business has not confirmed.', '/inbox'],
      ['Keep your team informed', 'Check delivery status before retrying a message. Ask an administrator if a channel is missing or an agent needs changing.', '/inbox'],
    ],
  },
};

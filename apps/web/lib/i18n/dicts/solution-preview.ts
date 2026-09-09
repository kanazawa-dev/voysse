const en = {
  title: "Preview update", hint: "Compare this installation with the selected version. This preview never applies an update or activates an agent.",
  fromTo: "Installed v{from} → preview v{to}", baseline: "Installed baseline", current: "Client value", target: "Target version",
  unchanged: "Unchanged", updated: "Would update", preserved: "Local value preserved", conflict: "Conflict — review required",
  conflicts: "Conflicts found. Nothing has been applied.", clean: "No field conflicts. Agent behavior has not been tested; applying updates is not available yet.",
  protect: "Protect this client value", protected: "Explicitly protected", detected: "Local difference detected",
  protectHint: "Protection saves a client-specific marker, even when the value matches the baseline. It does not change the agent value. Removing protection is not available yet.",
  stale: "This preview changed or the result is uncertain. Refresh before protecting another value.",
  invalid: "The stored settings cannot be previewed. Review the agent configuration.", error: "Could not load the preview. Retry or check your access.",
};
const es: typeof en = {
  title: "Vista previa de actualización", hint: "Compara esta instalación con la versión seleccionada. La vista previa nunca aplica cambios ni activa un agente.",
  fromTo: "Instalada v{from} → vista previa v{to}", baseline: "Base instalada", current: "Valor del cliente", target: "Versión destino",
  unchanged: "Sin cambios", updated: "Se actualizaría", preserved: "Se conserva el valor local", conflict: "Conflicto — requiere revisión",
  conflicts: "Hay conflictos. No se aplicó ningún cambio.", clean: "Sin conflictos entre campos. El comportamiento del agente no se ha probado; aplicar actualizaciones aún no está disponible.",
  protect: "Proteger este valor del cliente", protected: "Protegido explícitamente", detected: "Diferencia local detectada",
  protectHint: "La protección guarda una marca propia del cliente, incluso si el valor coincide con la base. No cambia el valor del agente. Quitar la protección aún no está disponible.",
  stale: "La vista previa cambió o el resultado es incierto. Actualiza antes de proteger otro valor.",
  invalid: "La configuración guardada no permite generar la vista previa. Revisa la configuración del agente.", error: "No pudimos cargar la vista previa. Reintenta o revisa tus permisos.",
};
export const solutionPreview = { en, es };

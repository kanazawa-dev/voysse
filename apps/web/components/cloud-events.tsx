"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, messageFrom } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CloudEvent = {
  id: string;
  status: string;
  error_code: string | null;
  conversation_id: string | null;
  preview: string;
  received_at: string;
  updated_at: string;
};

export function CloudEvents({ clientId }: { clientId: string }) {
  const { lang } = useLanguage();
  const es = lang === "es";
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      setEvents(
        await api<CloudEvent[]>(`/whatsapp-cloud/channels/${clientId}/events`),
      );
      setError("");
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }, [clientId]);
  useEffect(() => {
    void load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);
  const labels: Record<string, string> = es
    ? {
        queued: "En cola",
        preparing: "Preparando",
        ready: "Respuesta preparada",
        sending: "Enviando",
        sent: "Aceptado por el canal",
        ignored: "Sin respuesta automática",
        needs_review: "Requiere revisión",
        uncertain: "Envío incierto",
      }
    : {
        queued: "Queued",
        preparing: "Preparing",
        ready: "Reply prepared",
        sending: "Sending",
        sent: "Accepted by channel",
        ignored: "No automatic reply",
        needs_review: "Needs review",
        uncertain: "Uncertain send",
      };
  const reasons: Record<string, [string, string]> = {
    preparation_interrupted: [
      "El proceso se interrumpió. Revisa si ejecutó herramientas antes de responder.",
      "Processing was interrupted. Check tool actions before replying.",
    ],
    preparation_failed: [
      "Revisa la configuración del agente y atiende el mensaje manualmente.",
      "Check agent configuration and handle the message manually.",
    ],
    delivery_unknown: [
      "Puede haber llegado. Comprueba el canal antes de responder otra vez.",
      "It may have arrived. Check the channel before replying again.",
    ],
    reply_window_closed: [
      "La ventana de respuesta venció o falta la fecha del proveedor.",
      "The reply window expired or the provider timestamp is missing.",
    ],
    unsupported_content: [
      "Contenido no soportado: atención humana.",
      "Unsupported content: human attention required.",
    ],
    media_unavailable: [
      "No se pudo obtener el archivo. Atención humana necesaria.",
      "Could not retrieve the attachment. Human attention required.",
    ],
    destination_changed: [
      "Se cambió la cuenta o el agente después de recibir el mensaje.",
      "The account or agent changed after receipt.",
    ],
    destination_inactive: [
      "Destino inactivo; no se procesó automáticamente.",
      "Inactive destination; no automatic processing.",
    ],
    human_or_inactive: [
      "Control humano o destino inactivo.",
      "Human control or inactive destination.",
    ],
    reply_too_long: [
      "La respuesta supera el límite del canal.",
      "The reply exceeds the channel limit.",
    ],
  };
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {es ? "Actividad de recepción" : "Incoming activity"}
        </h2>
        <Button variant="outline" disabled={busy} onClick={load}>
          {es ? "Actualizar" : "Refresh"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {es
          ? "Últimos 50 eventos. El worker Cloud debe estar activo. Los estados inciertos no se reintentan automáticamente; aceptar un mensaje no garantiza su entrega."
          : "Latest 50 events. The Cloud worker must be running. Uncertain events are not retried automatically; acceptance does not guarantee delivery."}
      </p>
      {error && <p role="alert">{error}</p>}
      {!error && !events.length && (
        <p role="status">
          {busy
            ? es
              ? "Cargando…"
              : "Loading…"
            : es
              ? "Aún no hay eventos."
              : "No events yet."}
        </p>
      )}
      {events.map((event) => (
        <div key={event.id} className="space-y-2 rounded-2xl border p-4">
          <strong>{labels[event.status] ?? event.status}</strong>
          <p className="break-words text-sm">{event.preview}</p>
          {event.error_code && (
            <p className="text-sm">
              {reasons[event.error_code]?.[es ? 0 : 1] ?? event.error_code}
            </p>
          )}
          <small className="block break-all text-muted-foreground">
            {new Date(event.updated_at).toLocaleString(lang)} · {event.id}
          </small>
          {event.conversation_id && (
            <Link
              className="text-sm underline"
              href={`/inbox?conversation=${event.conversation_id}`}
            >
              {es ? "Ver conversación" : "View conversation"}
            </Link>
          )}
        </div>
      ))}
    </Card>
  );
}

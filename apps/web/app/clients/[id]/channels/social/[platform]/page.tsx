"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHead, Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError, messageFrom } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { Client } from "@/types";

type Channel = {
  id: string;
  agent_id: string;
  account_id: string;
  display_name: string;
  status: string;
  last_error: string | null;
};
type Event = {
  id: string;
  status: string;
  last_error: string | null;
  attempts: number;
  conversation_id: string | null;
};

export default function SocialChannelPage() {
  const { id, platform } = useParams<{ id: string; platform: string }>();
  const { lang } = useLanguage();
  const es = lang === "es";
  const valid = platform === "instagram" || platform === "messenger";
  const title =
    platform === "instagram" ? "Instagram DM" : "Facebook Messenger";
  const path = `/social/channels/${id}/${platform}`;
  const [client, setClient] = useState<Client | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [agent, setAgent] = useState("");
  const [account, setAccount] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!valid) return;
    setError("");
    try {
      const customer = await api<Client>(`/clients/${id}`);
      setClient(customer);
      const current = await api<Channel>(path).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      });
      setChannel(current);
      setAgent(current?.agent_id || customer.agents[0]?.id || "");
      setAccount(current?.account_id || "");
      setEvents(current ? await api<Event[]>(`${path}/events`) : []);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setLoading(false);
    }
  }, [id, path, valid]);
  useEffect(() => {
    void load();
  }, [load]);

  async function action(operation: string) {
    setBusy(true);
    setError("");
    try {
      if (operation === "save") {
        await api<Channel>(path, {
          method: "PUT",
          body: JSON.stringify({
            agent_id: agent,
            account_id: account,
            access_token: token || null,
          }),
        });
        setToken("");
      } else {
        await api(`${path}/${operation}`, { method: "POST" });
      }
      await load();
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(false);
    }
  }
  const statuses: Record<string, string> = es
    ? {
        disconnected: "Desconectado",
        awaiting_message: "Credenciales verificadas · esperando primer mensaje",
        connected: "Webhook activo",
        error: "Revisar conexión",
        queued: "En cola",
        ready: "Respuesta preparada",
        sending: "Enviando",
        sent: "Enviado",
        failed: "Preparación fallida",
        uncertain: "Entrega sin confirmar — revisar antes de responder",
        ignored: "Sin respuesta automática",
      }
    : {
        disconnected: "Disconnected",
        awaiting_message: "Credentials verified · awaiting first message",
        connected: "Webhook active",
        error: "Check connection",
        queued: "Queued",
        ready: "Reply prepared",
        sending: "Sending",
        sent: "Sent",
        failed: "Preparation failed",
        uncertain: "Delivery unconfirmed — check before replying",
        ignored: "No automatic reply",
      };
  if (!valid) return <p>{es ? "Canal no encontrado" : "Channel not found"}</p>;
  return (
    <div className="space-y-6">
      <PageHead
        title={title}
        description={
          client?.name || (es ? "Configurar canal" : "Configure channel")
        }
        action={
          <Button variant="secondary" render={<Link href="/channels" />}>
            {es ? "Volver a canales" : "Back to channels"}
          </Button>
        }
      />
      <Card className="p-5 text-sm">
        <strong>
          {es
            ? "Integración en validación · configuración manual"
            : "Integration under validation · manual setup"}
        </strong>
        <p>
          {es
            ? "Requiere una app Meta configurada por el administrador de la instalación. Instagram usa una cuenta profesional y token de Instagram Login; Messenger usa un token de Página. No pegues aquí el secreto de la app."
            : "Requires a Meta app configured by the installation owner. Instagram uses a professional account and Instagram Login token; Messenger uses a Page token. Do not enter the app secret here."}
        </p>
        <p>
          {es
            ? "Esta versión responde texto y deriva adjuntos a atención humana. No ejecuta herramientas automáticamente. Guardar no verifica permisos ni aprobación de Meta."
            : "This version replies with text and routes attachments to human attention. It does not execute tools automatically. Saving does not verify permissions or Meta approval."}
        </p>
      </Card>
      {error && <Alert>{error}</Alert>}
      {channel?.last_error && <Alert>{channel.last_error}</Alert>}
      {loading ? (
        <p>{es ? "Cargando…" : "Loading…"}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void action("save");
          }}
        >
          <Card className="space-y-4 p-5">
            <p role="status">
              {statuses[channel?.status || "disconnected"]}{" "}
              {channel?.display_name}
            </p>
            <div className="space-y-2">
              <Label htmlFor="social-agent">{es ? "Agente" : "Agent"}</Label>
              <Select
                value={agent}
                onValueChange={(value) => setAgent(value || "")}
              >
                <SelectTrigger id="social-agent">
                  <SelectValue>
                    {client?.agents.find((a) => a.id === agent)?.name ||
                      (es ? "Selecciona un agente" : "Select an agent")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {client?.agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-account">
                {es ? "ID de cuenta / Página" : "Account / Page ID"}
              </Label>
              <Input
                id="social-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]+"
                required
                disabled={Boolean(channel)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-token">
                {es
                  ? "Token de acceso (vacío conserva el guardado)"
                  : "Access token (blank keeps saved value)"}
              </Label>
              <Input
                id="social-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required={!channel}
              />
            </div>
            {!client?.agents.length && (
              <p>
                {es
                  ? "Primero crea un agente para este cliente."
                  : "First create an agent for this client."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !agent} type="submit">
                {es ? "Guardar" : "Save"}
              </Button>
              <Button
                disabled={busy || !channel}
                type="button"
                variant="secondary"
                onClick={() => void action("connect")}
              >
                {es ? "Verificar y conectar" : "Verify and connect"}
              </Button>
              <Button
                disabled={busy || !channel}
                type="button"
                variant="secondary"
                onClick={() => void action("disconnect")}
              >
                {es ? "Desconectar" : "Disconnect"}
              </Button>
            </div>
          </Card>
        </form>
      )}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2>{es ? "Procesamiento de mensajes" : "Message processing"}</h2>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            {es ? "Actualizar" : "Refresh"}
          </Button>
        </div>
        {!events.length && (
          <p>
            {es
              ? "Sin eventos. Configura el webhook y envía un mensaje de prueba autorizado."
              : "No events. Configure the webhook and send an authorized test message."}
          </p>
        )}
        {events.map((event) => (
          <div className="space-y-1 border-t pt-3 text-sm" key={event.id}>
            <strong>{statuses[event.status] || event.status}</strong>
            {event.last_error && <p>{event.last_error}</p>}
            {event.conversation_id && (
              <Link className="underline" href="/inbox">
                {es ? "Abrir Inbox" : "Open Inbox"}
              </Link>
            )}
            {event.status === "failed" && event.attempts < 3 && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void action(`events/${event.id}/retry`)}
              >
                {es ? "Reintentar preparación" : "Retry preparation"}
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

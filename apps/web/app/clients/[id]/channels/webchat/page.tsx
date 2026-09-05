"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, messageFrom } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { Client } from "@/types";

export default function WebchatChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLanguage();
  const es = lang === "es";
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Client>(`/clients/${id}`)
      .then(setClient)
      .catch((e) => setError(messageFrom(e)));
  }, [id]);
  return (
    <div className="space-y-6">
      <PageHead
        title="Web chat"
        description={
          es
            ? "Elige un agente para activar su widget y copiar el código de instalación."
            : "Choose an agent to enable its widget and copy the installation code."
        }
        action={
          <Button variant="secondary" render={<Link href="/channels" />}>
            {es ? "Volver" : "Back"}
          </Button>
        }
      />
      {error && <Alert>{error}</Alert>}
      {!client && !error && <p>{es ? "Cargando…" : "Loading…"}</p>}
      {client && !client.agents.length && (
        <Card className="space-y-3 p-5">
          <p>
            {es
              ? "Primero crea un agente para este cliente."
              : "Create an agent for this client first."}
          </p>
          <Button render={<Link href={`/clients/${id}`} />}>
            {es ? "Abrir cliente" : "Open client"}
          </Button>
        </Card>
      )}
      {client?.agents.map((agent) => (
        <Card
          className="flex flex-wrap items-center justify-between gap-4 p-5"
          key={agent.id}
        >
          <strong>{agent.name}</strong>
          <Button render={<Link href={`/agents/${agent.id}#widget`} />}>
            {es ? "Configurar widget" : "Configure widget"}
          </Button>
        </Card>
      ))}
    </div>
  );
}

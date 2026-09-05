"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Facebook,
  Globe2,
  Instagram,
  MessageCircle,
  QrCode,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useT, useLanguage } from "@/lib/i18n";
import type { Client } from "@/types";
import { Card } from "@/components/ui/card";

const futureChannels: {
  key: "instagram" | "facebook" | "webchat";
  icon: LucideIcon;
  className: string;
}[] = [
  {
    key: "instagram",
    icon: Instagram,
    className: "bg-pink-500/10 text-pink-600",
  },
  {
    key: "facebook",
    icon: Facebook,
    className: "bg-blue-500/10 text-blue-600",
  },
];

export default function ChannelsPage() {
  const t = useT();
  const { lang } = useLanguage();
  const es = lang === "es";
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  useEffect(() => {
    api<Client[]>("/clients").then(setClients);
  }, []);
  const selected = clients.find((item) => item.id === clientId);
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHead
        eyebrow={t("channels.head.eyebrow")}
        title={t("channels.head.title")}
        description={t("channels.head.description")}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-64 gap-1.5">
          <Label htmlFor="channel-client">
            {t("channels.toolbar.clientLabel")}
          </Label>
          <Select
            items={[
              { value: "__all__", label: t("channels.toolbar.allClients") },
              ...clients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
            value={clientId || "__all__"}
            onValueChange={(value) =>
              setClientId(!value || value === "__all__" ? "" : value)
            }
          >
            <SelectTrigger id="channel-client" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">
                {t("channels.toolbar.allClients")}
              </SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <Button
            variant="secondary"
            render={<Link href={`/clients/${selected.id}`} />}
          >
            {t("channels.toolbar.openClient")}
          </Button>
        )}
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 border-emerald-300">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary text-emerald-600">
            <MessageCircle size={24} />
          </div>
          <span className="opacity-70 text-emerald-700">
            {t("channels.whatsappCloud.status")}
          </span>
          <h3 className="font-heading">{t("channels.whatsappCloud.title")}</h3>
          <p>{t("channels.whatsappCloud.description")}</p>
          <small className="mt-4 text-sm text-muted-foreground">
            {selected?.name || t("channels.whatsappCloud.ownerPlaceholder")}
          </small>
          {selected ? (
            <Button
              render={
                <Link
                  href={`/clients/${selected.id}/channels/whatsapp-cloud`}
                />
              }
            >
              {t("channels.whatsappCloud.configure")} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              {t("channels.whatsappCloud.selectClient")}
            </Button>
          )}
        </Card>
        <Card className="p-5 border-emerald-300">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary text-emerald-600">
            <QrCode size={24} />
          </div>
          <span className="opacity-70 text-emerald-700">
            {t("channels.whatsapp.status")}
          </span>
          <h3 className="font-heading">{t("channels.whatsapp.title")}</h3>
          <p>{t("channels.whatsapp.description")}</p>
          <small className="mt-4 text-sm text-muted-foreground">
            {selected?.name || t("channels.whatsapp.ownerPlaceholder")}
          </small>
          {selected ? (
            <Button
              render={
                <Link href={`/clients/${selected.id}/channels/whatsapp`} />
              }
            >
              {t("channels.whatsapp.configure")} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              {t("channels.whatsapp.selectClient")}
            </Button>
          )}
        </Card>
        {futureChannels.map((channel) => (
          <Card className="p-5" key={channel.key}>
            <div
              className={`flex size-11 items-center justify-center rounded-xl ${channel.className}`}
            >
              <channel.icon size={24} />
            </div>
            <span className="text-sm text-muted-foreground">
              {es
                ? "Integración en validación"
                : "Integration under validation"}
            </span>
            <h3>{t(`channels.future.${channel.key}.name`)}</h3>
            <p>{t(`channels.future.${channel.key}.description`)}</p>
            {selected ? (
              <Button
                variant="secondary"
                render={
                  <Link
                    href={`/clients/${selected.id}/channels/social/${channel.key === "facebook" ? "messenger" : "instagram"}`}
                  />
                }
              >
                {t("channels.future.connect")}
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                {t("channels.whatsapp.selectClient")}
              </Button>
            )}
          </Card>
        ))}
        <Card className="p-5">
          <Globe2 size={24} />
          <span>{es ? "Disponible" : "Available"}</span>
          <h3>Web chat</h3>
          <p>{t("channels.future.webchat.description")}</p>
          {selected ? (
            <Button
              variant="secondary"
              render={
                <Link href={`/clients/${selected.id}/channels/webchat`} />
              }
            >
              {es ? "Configurar widget" : "Configure widget"}
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              {t("channels.whatsapp.selectClient")}
            </Button>
          )}
        </Card>
      </section>
      <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Radio size={18} className="mt-0.5 shrink-0" />
        <p>
          <strong>{t("channels.note.strong")}</strong> {t("channels.note.rest")}
        </p>
      </div>
    </div>
  );
}

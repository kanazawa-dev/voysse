"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Facebook, Globe2, Instagram, Lock, MessageCircle, QrCode, Radio, type LucideIcon } from "lucide-react";
import { PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Client } from "@/types";

const futureChannels: { key: "instagram" | "facebook" | "webchat"; icon: LucideIcon; className: string }[] = [
  { key: "instagram", icon: Instagram, className: "instagram" },
  { key: "facebook", icon: Facebook, className: "facebook" },
  { key: "webchat", icon: Globe2, className: "webchat" },
];

export default function ChannelsPage() {
  const t = useT();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  useEffect(() => { api<Client[]>("/clients").then(setClients); }, []);
  const selected = clients.find((item) => item.id === clientId);
  return <div className="page"><PageHead eyebrow={t("channels.head.eyebrow")} title={t("channels.head.title")} description={t("channels.head.description")} />
    <div className="channels-toolbar"><label htmlFor="channel-client">{t("channels.toolbar.clientLabel")}</label><select id="channel-client" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">{t("channels.toolbar.allClients")}</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>{selected && <Button variant="secondary" render={<Link href={`/clients/${selected.id}`} />}>{t("channels.toolbar.openClient")}</Button>}</div>
    <section className="channel-grid"><article className="channel-card channel-card-live"><div className="channel-icon whatsapp"><MessageCircle size={24} /></div><span className="coming live">{t("channels.whatsappCloud.status")}</span><h3>{t("channels.whatsappCloud.title")}</h3><p>{t("channels.whatsappCloud.description")}</p><small className="channel-owner">{selected?.name || t("channels.whatsappCloud.ownerPlaceholder")}</small>{selected ? <Button render={<Link href={`/clients/${selected.id}/channels/whatsapp-cloud`} />}>{t("channels.whatsappCloud.configure")} <ArrowRight size={16} /></Button> : <Button variant="secondary" disabled>{t("channels.whatsappCloud.selectClient")}</Button>}</article><article className="channel-card channel-card-live"><div className="channel-icon whatsapp"><QrCode size={24} /></div><span className="coming live">{t("channels.whatsapp.status")}</span><h3>{t("channels.whatsapp.title")}</h3><p>{t("channels.whatsapp.description")}</p><small className="channel-owner">{selected?.name || t("channels.whatsapp.ownerPlaceholder")}</small>{selected ? <Button render={<Link href={`/clients/${selected.id}/channels/whatsapp`} />}>{t("channels.whatsapp.configure")} <ArrowRight size={16} /></Button> : <Button variant="secondary" disabled>{t("channels.whatsapp.selectClient")}</Button>}</article>{futureChannels.map((channel) => <article className="channel-card" key={channel.key}><div className={`channel-icon ${channel.className}`}><channel.icon size={24} /></div><span className="coming"><Lock size={12} /> {t("channels.future.comingSoon")}</span><h3>{t(`channels.future.${channel.key}.name`)}</h3><p>{t(`channels.future.${channel.key}.description`)}</p><small className="channel-owner">{selected?.name || t("channels.future.ownerPlaceholder")}</small><Button variant="secondary" disabled>{t("channels.future.connect")}</Button></article>)}</section>
    <div className="channels-note"><Radio size={18} /><p><strong>{t("channels.note.strong")}</strong> {t("channels.note.rest")}</p></div>
  </div>;
}

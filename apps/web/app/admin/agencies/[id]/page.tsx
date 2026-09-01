"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, LoaderCircle, MessageSquareText, Radio, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { PageHead } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminUser, AgencyDetail } from "@/types";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <Card className="flex gap-4 p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-2xl [&_strong]:font-semibold">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div><small>{label}</small><strong>{value ?? "—"}</strong></div>
    </Card>
  );
}

export default function AdminAgencyDetailPage() {
  const t = useT();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<AgencyDetail | null>(null);

  useEffect(() => {
    api<AdminUser>("/admin/auth/me")
      .then(() => api<AgencyDetail>(`/admin/agencies/${id}`))
      .then(setAgency)
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading || !agency) {
    return <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground"><LoaderCircle className="animate-spin" /> {t("shell.loading")}</div>;
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-8">
        <OpenvoissBrand effect="benday" showName size={28} state="thinking" />
        <LanguageSwitcher className="border" />
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
        <Link href="/admin" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"><ArrowLeft size={15} /> {t("admin.agencies.back")}</Link>
        <PageHead
          eyebrow={agency.slug}
          title={agency.name}
          description={agency.owner_email ?? ""}
          action={<span className={agency.is_active ? "inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary" : "inline-flex rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-xs text-destructive"}>{agency.is_active ? t("admin.agencies.active") : t("admin.agencies.inactive")}</span>}
        />

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Users size={20} />} label={t("admin.agencies.thUsers")} value={agency.user_count} />
          <StatCard icon={<Building2 size={20} />} label={t("admin.agencies.thClients")} value={agency.client_count} />
          <StatCard icon={<MessageSquareText size={20} />} label={t("admin.agencies.detail.messagesTotal")} value={agency.messages_total} />
        </section>

        <div>
          <h2 className="mb-3 font-heading">{t("admin.agencies.detail.usersTitle")}</h2>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("admin.agencies.detail.thUserName")}</TableHead><TableHead>{t("admin.agencies.detail.thUserEmail")}</TableHead><TableHead>{t("admin.agencies.detail.thUserRole")}</TableHead><TableHead>{t("admin.agencies.detail.thUserCreated")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {agency.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell><a className="hover:text-primary hover:underline" href={`mailto:${user.email}`}>{user.email}</a></TableCell>
                    <TableCell className="text-muted-foreground">{user.role}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-heading">{t("admin.agencies.detail.clientsTitle")}</h2>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("admin.agencies.detail.thClientName")}</TableHead><TableHead>{t("admin.agencies.detail.thAgentCount")}</TableHead><TableHead>{t("admin.agencies.detail.thWhatsapp")}</TableHead><TableHead>{t("admin.agencies.thStatus")}</TableHead><TableHead>{t("admin.agencies.detail.thClientCreated")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {agency.clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.agent_count}</TableCell>
                    <TableCell>
                      {client.whatsapp_status === "connected" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary"><Radio size={11} /> {client.whatsapp_status}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{client.whatsapp_status ?? t("admin.agencies.detail.whatsappNone")}</span>
                      )}
                    </TableCell>
                    <TableCell><span className={client.is_active ? "inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary" : "inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground"}>{client.is_active ? t("admin.agencies.active") : t("admin.agencies.inactive")}</span></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(client.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}

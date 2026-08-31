"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Inbox, LoaderCircle, LogOut } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { EmptyState, PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/toast";
import type { AdminUser, AgencyAdmin, CloudLead } from "@/types";

export default function AdminPage() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leads" | "agencies">("leads");
  const [leads, setLeads] = useState<CloudLead[]>([]);
  const [agencies, setAgencies] = useState<AgencyAdmin[]>([]);
  const [busyAgencyId, setBusyAgencyId] = useState("");

  useEffect(() => {
    api<AdminUser>("/admin/auth/me")
      .then((me) => {
        setAdmin(me);
        return Promise.all([api<CloudLead[]>("/admin/leads"), api<AgencyAdmin[]>("/admin/agencies")]);
      })
      .then(([l, a]) => { setLeads(l); setAgencies(a); })
      .catch(() => router.replace("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await api("/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function toggleAgency(agency: AgencyAdmin) {
    const next = !agency.is_active;
    if (next === false && !confirm(t("admin.agencies.confirmSuspend", { name: agency.name }))) return;
    setBusyAgencyId(agency.id);
    try {
      const updated = await api<AgencyAdmin>(`/admin/agencies/${agency.id}`, { method: "PATCH", body: JSON.stringify({ is_active: next }) });
      setAgencies((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      toast.error(messageFrom(err));
    } finally {
      setBusyAgencyId("");
    }
  }

  if (loading || !admin) {
    return <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground"><LoaderCircle className="animate-spin" /> {t("shell.loading")}</div>;
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-8">
        <OpenvoissBrand effect="benday" showName size={28} state="thinking" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="border" />
          <Button type="button" variant="ghost" size="sm" onClick={logout}><LogOut size={15} /> {t("admin.logout")}</Button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
        <PageHead eyebrow={t("admin.head.eyebrow")} title={t("admin.head.title")} description={t("admin.head.description")} />

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="leads">{t("admin.tabs.leads")} <span>{leads.length}</span></TabsTrigger>
            <TabsTrigger value="agencies">{t("admin.tabs.agencies")} <span>{agencies.length}</span></TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "leads" && (
          leads.length ? (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t("admin.leads.thName")}</TableHead><TableHead>{t("admin.leads.thEmail")}</TableHead><TableHead>{t("admin.leads.thAgency")}</TableHead><TableHead>{t("admin.leads.thDate")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell><a className="hover:text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></TableCell>
                      <TableCell>{lead.agency_name}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : <EmptyState icon={<Inbox />} title={t("admin.leads.empty")} description={t("admin.leads.emptyDesc")} />
        )}

        {tab === "agencies" && (
          agencies.length ? (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t("admin.agencies.thName")}</TableHead><TableHead>{t("admin.agencies.thOwner")}</TableHead><TableHead>{t("admin.agencies.thUsers")}</TableHead><TableHead>{t("admin.agencies.thClients")}</TableHead><TableHead>{t("admin.agencies.thStatus")}</TableHead><TableHead>{t("admin.agencies.thCreated")}</TableHead><TableHead>{t("admin.agencies.thAction")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {agencies.map((agency) => (
                    <TableRow key={agency.id}>
                      <TableCell className="font-medium">{agency.name}</TableCell>
                      <TableCell className="text-muted-foreground">{agency.owner_email || "—"}</TableCell>
                      <TableCell>{agency.user_count}</TableCell>
                      <TableCell>{agency.client_count}</TableCell>
                      <TableCell><span className={agency.is_active ? "inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary" : "inline-flex rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs text-destructive"}>{agency.is_active ? t("admin.agencies.active") : t("admin.agencies.suspended")}</span></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(agency.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button type="button" size="sm" variant={agency.is_active ? "destructive" : "secondary"} disabled={busyAgencyId === agency.id} onClick={() => toggleAgency(agency)}>
                          {busyAgencyId === agency.id ? <LoaderCircle className="animate-spin" size={14} /> : null}
                          {agency.is_active ? t("admin.agencies.suspend") : t("admin.agencies.reactivate")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : <EmptyState icon={<Building2 />} title={t("admin.agencies.empty")} description={t("admin.agencies.emptyDesc")} />
        )}
      </div>
    </div>
  );
}

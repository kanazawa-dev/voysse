"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, messageFrom } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator";
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
};

export default function TeamPage() {
  const { lang: language } = useLanguage();
  const es = language === "es";
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [self, setSelf] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const [people, invites, me] = await Promise.all([
      api<Member[]>("/team/members"),
      api<Invitation[]>("/team/invitations"),
      api<{ id: string }>("/auth/me"),
    ]);
    setMembers(people);
    setInvitations(invites);
    setSelf(me.id);
  }, []);
  useEffect(() => {
    reload()
      .catch((err) => setError(messageFrom(err)))
      .finally(() => setLoading(false));
  }, [reload]);

  async function act(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setLink("");
    try {
      await api(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      await reload();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setLink("");
    try {
      const result = await api<{ token: string }>("/team/invitations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setLink(
        `${window.location.origin}/accept-invitation#token=${result.token}`,
      );
      form.reset();
      await reload();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">
          {es ? "Tu equipo" : "Your team"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {es
            ? "Administradores: gestionan toda la agencia. Operadores: leen y atienden el Inbox de todos los clientes."
            : "Administrators manage the agency. Operators read and respond in every client's Inbox."}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Card className="space-y-4 p-6">
        <h2 className="text-xl font-semibold">
          {es ? "Invitar a una persona" : "Invite a teammate"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {es
            ? "Comparte el enlace por un canal privado. No enviamos correo automáticamente. Caduca en 48 horas; quien lo tenga puede aceptar. Crear otro para el mismo correo invalida el anterior."
            : "Share the link privately. No email is sent automatically. It expires in 48 hours; anyone holding it can accept. Reissuing for the same email revokes the old link."}
        </p>
        <form
          onSubmit={invite}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="email">{es ? "Correo" : "Email"}</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">{es ? "Permiso" : "Role"}</Label>
            <select
              className="h-10 rounded-full border bg-background px-4"
              id="role"
              name="role"
              defaultValue="operator"
            >
              <option value="operator">{es ? "Operador" : "Operator"}</option>
              <option value="admin">
                {es ? "Administrador" : "Administrator"}
              </option>
            </select>
          </div>
          <Button disabled={busy || loading} type="submit">
            {es ? "Crear invitación" : "Create invitation"}
          </Button>
        </form>
        {link && (
          <div role="status" className="space-y-2">
            <Label htmlFor="invite-link">
              {es
                ? "Copia este enlace; solo se muestra ahora"
                : "Copy this link; it is shown only now"}
            </Label>
            <Input
              id="invite-link"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="text-xl font-semibold">{es ? "Miembros" : "Members"}</h2>
        {loading && <p role="status">{es ? "Cargando…" : "Loading…"}</p>}
        {members.map((member) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          >
            <div className="min-w-0 break-words">
              <strong>{member.name}</strong>
              <p className="text-sm text-muted-foreground">
                {member.email} · {member.role}
              </p>
            </div>
            {member.id !== self && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        es
                          ? "¿Cambiar permisos? Se cerrarán sus sesiones actuales."
                          : "Change permissions? Existing sessions will be revoked.",
                      )
                    )
                      void act(`/team/members/${member.id}`, "PATCH", {
                        role: member.role === "admin" ? "operator" : "admin",
                      });
                  }}
                >
                  {member.role === "admin"
                    ? es
                      ? "Hacer operador"
                      : "Make operator"
                    : es
                      ? "Hacer administrador"
                      : "Make administrator"}
                </Button>
                <Button
                  disabled={busy}
                  variant="destructive"
                  onClick={() => {
                    if (
                      window.confirm(
                        es
                          ? "¿Retirar a esta persona del equipo?"
                          : "Remove this teammate?",
                      )
                    )
                      void act(`/team/members/${member.id}`, "DELETE");
                  }}
                >
                  {es ? "Retirar" : "Remove"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </Card>
      <Card className="space-y-4 p-6">
        <h2 className="text-xl font-semibold">
          {es ? "Invitaciones pendientes" : "Pending invitations"}
        </h2>
        {!loading && !invitations.length && (
          <p>
            {es ? "No hay invitaciones pendientes." : "No pending invitations."}
          </p>
        )}
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          >
            <div className="min-w-0 break-words">
              {invitation.email}
              <p className="text-sm text-muted-foreground">
                {invitation.role} · {es ? "Caduca" : "Expires"}:{" "}
                {new Date(invitation.expires_at).toLocaleString(language)}
              </p>
            </div>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                void act(`/team/invitations/${invitation.id}`, "DELETE")
              }
            >
              {es ? "Revocar" : "Revoke"}
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

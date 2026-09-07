"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import styles from "./booking-dialog.module.css";

const Calendar = dynamic(() => import("./booking-calendar"), {
  ssr: false,
  loading: () => <p role="status">Cal.com…</p>,
});

export function BookingDialog({ href, children }: { href: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { lang } = useLanguage();
  const es = lang === "es";
  const calLink = new URL(href).pathname.slice(1);
  const title = calLink.endsWith("voysse-cloud")
    ? (es ? "Conoce Voysse Cloud con Alex" : "Explore Voysse Cloud with Alex")
    : (es ? "Hablemos de tu proyecto" : "Let's talk about your project");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" data-acquisition-booking className="cy-action" />}>
        {children}<ArrowUpRight size={15} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <div className={styles.header}>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={styles.description}>
              {es ? "Hablarás directamente conmigo, Alex. Elige el horario que te acomode." : "You'll speak directly with me, Alex. Choose a time that works for you."}
            </DialogDescription>
          </div>
          <DialogClose className={styles.close} aria-label={es ? "Cerrar calendario" : "Close calendar"}>
            <X size={20} aria-hidden="true" />
          </DialogClose>
        </div>
        <div className={styles.calendar}>
          {open && <Calendar key={calLink} calLink={calLink} />}
        </div>
        <p className={styles.fallback}>
          {es ? "¿No carga el calendario? " : "Calendar not loading? "}
          <a href={href} target="_blank" rel="noopener noreferrer">{es ? "Abrir en Cal.com" : "Open in Cal.com"}</a>
          {" · "}<a href="mailto:alex@voysse.cl">{es ? "Escríbeme" : "Email me"}</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { ReactNode } from "react";
import { Alert as AlertPrimitive, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant="outline" className={cn("gap-1.5", active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}><span className="size-1.5 rounded-full bg-current" />{active ? "Activo" : "Inactivo"}</Badge>;
}

export function Modal({ open, title, description, onClose, children }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>{children}</DialogContent></Dialog>;
}

export function PageHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <span className="mb-1 block text-xs font-medium uppercase tracking-widest text-primary">{eyebrow}</span>}<h1 className="font-pixel text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</header>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center"><div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div><h3 className="font-heading mt-4 font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function Alert({ type = "error", children }: { type?: "error" | "success" | "info"; children: ReactNode }) {
  return <AlertPrimitive variant={type === "error" ? "destructive" : "default"} className={cn(type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800", type === "info" && "border-blue-200 bg-blue-50 text-blue-800")}><AlertDescription>{children}</AlertDescription></AlertPrimitive>;
}

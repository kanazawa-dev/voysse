import { BloubAvatar } from "@/components/bloub-avatar";
import { ReactNode } from "react";

export function PublicEmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><BloubAvatar size={88} mood="listening" /><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function PublicAlert({ type = "error", children }: { type?: "error" | "success" | "info"; children: ReactNode }) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}

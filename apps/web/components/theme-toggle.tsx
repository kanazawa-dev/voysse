"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

function subscribe(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const sync = (event: StorageEvent) => {
    if (event.key === "voysse.theme") {
      document.documentElement.classList.toggle("dark", event.newValue === "dark");
    }
  };
  window.addEventListener("storage", sync);
  return () => { observer.disconnect(); window.removeEventListener("storage", sync); };
}
const snapshot = () => document.documentElement.classList.contains("dark");

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  const { lang } = useLanguage();
  const label = lang === "es"
    ? (dark ? "Activar modo claro" : "Activar modo oscuro")
    : (dark ? "Switch to light mode" : "Switch to dark mode");
  return (
    <button type="button" className="cy-theme-toggle" aria-label={label} title={label}
      onClick={() => {
        const next = !snapshot();
        document.documentElement.classList.toggle("dark", next);
        try { localStorage.setItem("voysse.theme", next ? "dark" : "light"); } catch { /* Storage may be blocked. */ }
      }}>
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}

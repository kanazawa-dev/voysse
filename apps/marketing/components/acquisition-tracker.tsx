"use client";

import { useEffect, useRef } from "react";
import { appUrl } from "@/lib/app-url";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
type Event = "pageview" | "app" | "docs" | "github" | "booking";

// No visitor ID or browser storage. A new page load is a new pageview, not a unique visit.
export function AcquisitionTracker() {
  const recorded = useRef(false);
  useEffect(() => {
    if (!apiUrl || navigator.doNotTrack === "1" ||
        (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const raw = new URLSearchParams(location.search).get("utm_source");
    const source = raw === null ? "direct" : raw.trim().toLowerCase();
    // Open channel vocabulary; reject malformed labels rather than transmitting arbitrary query data.
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(source)) return;
    const send = (event: Event) => {
      void fetch(apiUrl.replace(/\/$/, "") + "/api/acquisition/events", {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, event }), keepalive: true,
      }).catch(() => { /* Analytics must never break navigation. No retries that inflate counts. */ });
    };
    if (!recorded.current) { recorded.current = true; send("pageview"); }
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-acquisition-booking]")) { send("booking"); return; }
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const url = new URL(link.href, location.href);
      if (url.origin === new URL(appUrl || location.origin, location.origin).origin && url.pathname === "/login") send("app");
      else if (url.origin === "https://docs.voysse.cl") send("docs");
      else if (url.origin === "https://github.com" && url.pathname.startsWith("/kanazawa-dev/voysse")) send("github");
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return null;
}

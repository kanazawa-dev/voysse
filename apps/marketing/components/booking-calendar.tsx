"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

const config = { theme: "light", layout: "month_view" } as const;
export default function BookingCalendar({ calLink }: { calLink: string }) {
  const namespace = calLink.split("/").at(-1)!;
  useEffect(() => {
    void getCalApi({ namespace, embedJsUrl: "https://cal.com/embed.js" }).then(cal => {
      const palette = { "cal-bg": "#ffffff", "cal-bg-subtle": "#f4f4f5", "cal-bg-muted": "#fafafa",
        "cal-text": "#18181b", "cal-text-emphasis": "#18181b", "cal-text-subtle": "#52525b",
        "cal-brand": "#5135ff", "cal-brand-text": "#ffffff" };
      cal("ui", { theme: "light", layout: "month_view", styles: { body: { background: "#ffffff" } }, cssVarsPerTheme: { light: palette, dark: palette } });
    });
  }, [namespace]);
  return <Cal calLink={calLink} namespace={namespace} calOrigin="https://cal.com"
    embedJsUrl="https://cal.com/embed.js" config={config}
    style={{ width: "100%", height: "100%", overflow: "auto" }} />;
}

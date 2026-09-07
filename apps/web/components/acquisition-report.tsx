"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Report = { truncated: boolean; rows: { source: string; event: string; count: number }[] };
export function AcquisitionReport() {
  const { lang } = useLanguage();
  const es = lang === "es";
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { api<Report>("/admin/acquisition").then(setReport).catch(() => setError(true)); }, []);
  const events = ["pageview", "app", "docs", "github", "booking"];
  const sources = [...new Set(report?.rows.map(row => row.source))];
  return <Card className="overflow-hidden p-4">
    <h2 className="font-semibold">{es ? "Canales de adquisición · últimos 30 días UTC" : "Acquisition channels · last 30 UTC days"}</h2>
    <p className="text-sm text-muted-foreground">{es ? "Vistas de página y clics aproximados, no visitantes únicos ni conversiones confirmadas. Direct = sin utm_source." : "Approximate pageviews and clicks, not unique visitors or confirmed conversions. Direct = no utm_source."}</p>
    {error ? <p role="alert">{es ? "No se pudieron cargar las métricas." : "Could not load metrics."}</p>
      : !report ? <p role="status">{es ? "Cargando…" : "Loading…"}</p>
      : !sources.length ? <p>{es ? "Todavía no hay eventos. Verifica NEXT_PUBLIC_API_URL en marketing." : "No events yet. Check NEXT_PUBLIC_API_URL in marketing."}</p>
      : <Table><TableHeader><TableRow><TableHead>{es ? "Canal" : "Channel"}</TableHead>
        {(es ? ["Vistas", "Clics App", "Clics Docs", "Clics GitHub", "Abrir calendario"] : ["Views", "App clicks", "Docs clicks", "GitHub clicks", "Open calendar"]).map(label => <TableHead key={label}>{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>{sources.map(source => <TableRow key={source}>
        <TableCell className="max-w-64 break-all">{source}</TableCell>
        {events.map(event => <TableCell key={event}>{report.rows.find(row => row.source === source && row.event === event)?.count ?? 0}</TableCell>)}
      </TableRow>)}</TableBody></Table>}
    {report?.truncated && <p role="status">{es ? "Resultado parcial: se muestran los 1000 grupos con más eventos." : "Partial result: showing the 1000 largest event groups."}</p>}
  </Card>;
}

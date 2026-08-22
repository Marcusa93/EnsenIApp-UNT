import Link from "next/link";
import { FileBarChart, ChevronRight } from "lucide-react";
import type { Json } from "@/lib/types/database";
import { Badge, Card, CardHeader, CardTitle, CardDescription, EmptyState } from "@/components/ui";
import { REPORT_SCOPE_LABEL, isReportScope, parseReportFilters } from "@/lib/reports/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { ReportStatusBadge } from "./report-status-badge";

export interface ReportListItem {
  id: string;
  scope: string;
  filters: Json;
  status: "pending" | "processing" | "ready" | "error";
  created_at: string;
  completed_at: string | null;
}

export interface ReportListProps {
  reports: ReportListItem[];
  classes: { id: string; topic: string }[];
  activities: { id: string; title: string }[];
  students: { id: string; full_name: string }[];
}

export function describeReportFilters(
  filters: Json,
  lookups: Pick<ReportListProps, "classes" | "activities" | "students">,
): string[] {
  const f = parseReportFilters(filters);
  const parts: string[] = [];
  if (f.student_id) parts.push(lookups.students.find((s) => s.id === f.student_id)?.full_name ?? "Estudiante");
  if (f.class_id) parts.push(lookups.classes.find((c) => c.id === f.class_id)?.topic ?? "Clase");
  if (f.activity_id) parts.push(lookups.activities.find((a) => a.id === f.activity_id)?.title ?? "Actividad");
  if (f.from || f.to) parts.push(`${f.from ?? "inicio"} → ${f.to ?? "hoy"}`);
  return parts;
}

export function ReportList({ reports, classes, activities, students }: ReportListProps) {
  return (
    <Card padding="sm" className="self-start">
      <CardHeader className="px-2 pt-2">
        <CardTitle as="h2" eyebrow="Historial">
          Informes pedidos
        </CardTitle>
        <CardDescription>Los informes quedan guardados para volver a leerlos o compararlos.</CardDescription>
      </CardHeader>

      {reports.length === 0 ? (
        <EmptyState
          compact
          icon={FileBarChart}
          tone="accent-2"
          title="Todavía no pediste informes"
          description="El primero tarda un par de minutos. Probá con “Uso del campus” para tener una foto general."
        />
      ) : (
        <ul className="stagger flex flex-col gap-1.5">
          {reports.map((r) => {
            const filters = describeReportFilters(r.filters, { classes, activities, students });
            const question = parseReportFilters(r.filters).question;
            return (
              <li key={r.id}>
                <Link
                  href={`/campus/docente/informes/${r.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {isReportScope(r.scope) ? REPORT_SCOPE_LABEL[r.scope] : r.scope}
                      </span>
                      <ReportStatusBadge status={r.status} size="sm" />
                    </div>
                    {(filters.length > 0 || question) && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {question ? `“${question}”` : filters.join(" · ")}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                      <time dateTime={r.created_at} title={formatDateTime(r.created_at)}>
                        {formatRelative(r.created_at)}
                      </time>
                      {filters.length > 0 && question && ` · ${filters.join(" · ")}`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {reports.length > 0 && (
        <p className="px-3 pt-2 text-[11px] text-muted">
          {reports.length === 40 ? "Se muestran los últimos 40 informes." : `${reports.length} informe${reports.length === 1 ? "" : "s"}.`}
        </p>
      )}
    </Card>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarRange, FileBarChart, Filter, HelpCircle } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { REPORT_SCOPE_LABEL, isReportScope, parseReportFilters } from "@/lib/reports/types";
import { ReportStatusBadge } from "@/components/informes/report-status-badge";
import { ReportRunner } from "@/components/informes/report-runner";
import { ReportView } from "@/components/informes/report-view";

export const metadata: Metadata = { title: "Informe · EnsenIA UNT" };

interface PageProps {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ run?: string }>;
}

export default async function InformeDetallePage({ params, searchParams }: PageProps) {
  const [{ reportId }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(reportId).success) notFound();
  await requireRole("docente", "admin");
  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("report_requests")
    .select("*, course:courses(id, name, term)")
    .eq("id", reportId)
    .maybeSingle();
  if (error) {
    console.error("[informes/detalle] lectura", { reportId, error });
    throw new Error("No se pudo cargar el informe.");
  }
  if (!report) notFound();

  const filters = parseReportFilters(report.filters);
  const course = report.course as { id: string; name: string; term: string } | null;

  const [cls, activity, student] = await Promise.all([
    filters.class_id
      ? supabase.from("classes").select("id, topic").eq("id", filters.class_id).maybeSingle()
      : Promise.resolve({ data: null }),
    filters.activity_id
      ? supabase.from("activities").select("id, title").eq("id", filters.activity_id).maybeSingle()
      : Promise.resolve({ data: null }),
    filters.student_id
      ? supabase.from("profiles").select("id, full_name").eq("id", filters.student_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const chips: { icon: React.ReactNode; label: string }[] = [];
  if (student.data) chips.push({ icon: <Filter />, label: student.data.full_name });
  if (cls.data) chips.push({ icon: <Filter />, label: cls.data.topic });
  if (activity.data) chips.push({ icon: <Filter />, label: activity.data.title });
  if (filters.from || filters.to) {
    chips.push({ icon: <CalendarRange />, label: `${filters.from ?? "inicio"} → ${filters.to ?? "hoy"}` });
  }

  const scopeLabel = isReportScope(report.scope) ? REPORT_SCOPE_LABEL[report.scope] : report.scope;
  const autoRun = sp.run === "1" && report.status === "pending";

  return (
    <>
      <Link
        href="/campus/docente/informes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver a informes
      </Link>

      <PageHeader
        eyebrow={`Informe · ${course ? `${course.name} · ${course.term}` : "Curso"}`}
        title={scopeLabel}
        description={
          filters.question ? (
            <span className="inline-flex items-start gap-2">
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-accent-2" aria-hidden />
              <span>“{filters.question}”</span>
            </span>
          ) : (
            "Informe generado con IA a partir de datos agregados del campus."
          )
        }
        top={
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={report.status} />
            {chips.map((c) => (
              <Badge key={c.label} tone="muted">
                {c.label}
              </Badge>
            ))}
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
              Pedido{" "}
              <time dateTime={report.created_at} title={formatDateTime(report.created_at)}>
                {formatRelative(report.created_at)}
              </time>
              {report.status === "ready" && report.completed_at && (
                <>
                  {" · "}listo{" "}
                  <time dateTime={report.completed_at} title={formatDateTime(report.completed_at)}>
                    {formatRelative(report.completed_at)}
                  </time>
                </>
              )}
            </span>
          </div>
        }
        actions={
          <ReportRunner
            reportId={report.id}
            status={report.status}
            autoRun={autoRun}
            resultMd={report.status === "ready" ? report.result_md : null}
          />
        }
      />

      {report.status === "ready" && report.result_md ? (
        <ReportView markdown={report.result_md} />
      ) : report.status === "error" ? (
        <Card className="border-danger/40">
          <EmptyState
            tone="accent-3"
            icon={FileBarChart}
            title="La generación falló"
            description={report.result_md ?? "Ocurrió un error desconocido. Probá regenerar el informe."}
          />
        </Card>
      ) : (
        <EmptyState
          tone="accent-2"
          icon={FileBarChart}
          title={report.status === "processing" ? "Estamos generando el informe" : "El informe todavía no se generó"}
          description={
            report.status === "processing"
              ? "Esta página se actualiza sola cuando esté listo."
              : "Tocá “Generar informe” para reunir los datos y pedirle el análisis a la IA."
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/docente/informes">Pedir otro informe</Link>
            </Button>
          }
        />
      )}
    </>
  );
}

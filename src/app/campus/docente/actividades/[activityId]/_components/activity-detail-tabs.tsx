"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Download, FileEdit, Inbox, Search } from "lucide-react";
import { Avatar, Button, Card, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { errorMessage } from "@/lib/utils";
import type { Activity } from "@/lib/types/helpers";
import { SubmissionStatusBadge } from "@/components/activities/badges";
import { ActivityForm, type ActivityFormProps } from "@/components/activities/activity-form";
import { effectiveScore, formatScore, type SubmissionStatus } from "@/components/activities/model";
import type { ActivityClassRef, SubmissionWithStudent } from "@/components/activities/queries";
import { exportSubmissionsCsv } from "../../actions";

type EditorData = Pick<ActivityFormProps, "courseId" | "courseName" | "classes" | "materials" | "students"> & {
  assigned: string[];
};

export function ActivityDetailTabs({
  activity,
  submissions,
  editor,
  initialTab,
}: {
  activity: Activity & { class: ActivityClassRef | null };
  submissions: SubmissionWithStudent[];
  editor: EditorData | null;
  initialTab?: string;
}) {
  const [tab, setTab] = React.useState(initialTab === "editar" && editor ? "editar" : "entregas");
  const [status, setStatus] = React.useState<"" | SubmissionStatus>("");
  const [query, setQuery] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = submissions.filter(
    (s) =>
      (!status || s.status === status) &&
      (!q || (s.student?.full_name ?? "").toLowerCase().includes(q) || (s.student?.email ?? "").toLowerCase().includes(q)),
  );

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await exportSubmissionsCsv(activity.id);
      if (!res.ok) throw new Error(res.error);
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "No se pudo exportar el CSV."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Secciones de la actividad">
        <TabsTrigger value="entregas" icon={<Inbox />} count={submissions.length}>
          Entregas
        </TabsTrigger>
        <TabsTrigger value="consigna">Consigna</TabsTrigger>
        {editor && (
          <TabsTrigger value="editar" icon={<FileEdit />}>
            Editar
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="entregas">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            leftIcon={<Search />}
            placeholder="Buscar estudiante…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar entregas"
            className="h-10"
          />
          <Select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | SubmissionStatus)}
            className="sm:w-48 [&>select]:h-10"
            options={[
              { value: "", label: "Todos los estados" },
              { value: "entregada", label: "Entregadas" },
              { value: "corregida", label: "Corregidas" },
              { value: "en_progreso", label: "En progreso" },
              { value: "reabierta", label: "Reabiertas" },
            ]}
          />
          <Button
            variant="secondary"
            leftIcon={<Download />}
            loading={exporting}
            disabled={submissions.length === 0}
            onClick={exportCsv}
            className="sm:ml-auto"
          >
            Exportar CSV
          </Button>
        </div>
        {error && (
          <p className="mb-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            {submissions.length === 0
              ? activity.status === "draft"
                ? "Publicá la actividad para que los estudiantes puedan empezar."
                : "Todavía nadie empezó esta actividad."
              : "Ninguna entrega coincide con el filtro."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2/60 text-left font-mono text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Estudiante</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Puntaje</th>
                  <th className="px-4 py-3 font-medium">Tiempo</th>
                  <th className="px-4 py-3 font-medium">Entregada</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((s) => (
                  <tr key={s.id} className="group transition-colors hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.student?.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.student?.full_name ?? "—"}</p>
                          <p className="truncate font-mono text-[11px] text-muted">{s.student?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SubmissionStatusBadge status={s.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {formatScore(effectiveScore(s), activity.max_score)}
                      {s.score == null && s.auto_score != null && (
                        <span className="ml-1 text-[10px] uppercase tracking-widest text-muted">auto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">{formatDuration(s.time_spent_seconds)}</td>
                    <td className="px-4 py-3 text-muted" title={s.submitted_at ? formatDateTime(s.submitted_at) : undefined}>
                      {s.submitted_at ? formatRelative(s.submitted_at) : "—"}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button asChild size="sm" variant="ghost" rightIcon={<ArrowRight />}>
                        <Link href={`/campus/docente/actividades/${activity.id}/entregas/${s.id}`}>
                          {s.status === "corregida" ? "Ver" : "Corregir"}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="consigna">
        <Card>
          {activity.instructions_md ? (
            <Markdown>{activity.instructions_md}</Markdown>
          ) : (
            <p className="text-sm text-muted">Esta actividad no tiene consigna escrita.</p>
          )}
        </Card>
      </TabsContent>

      {editor && (
        <TabsContent value="editar">
          {activity.status !== "draft" && (
            <p className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              La actividad ya está {activity.status === "published" ? "publicada" : "cerrada"}: los cambios se ven al instante
              para los estudiantes. Si cambiás preguntas de un cuestionario, las entregas anteriores conservan su puntaje.
            </p>
          )}
          <ActivityForm
            mode="edit"
            courseId={editor.courseId}
            courseName={editor.courseName}
            classes={editor.classes}
            materials={editor.materials}
            students={editor.students}
            initial={{ activity, assigned: editor.assigned }}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

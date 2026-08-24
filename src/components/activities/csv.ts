import Papa from "papaparse";
import { formatDateTime, formatDuration } from "@/lib/format";
import { SUBMISSION_STATUS_LABEL, effectiveScore } from "./model";
import type { SubmissionWithStudent } from "./queries";

/** CSV (UTF-8 con BOM para Excel, separador ;) de las entregas de una actividad. */
export function buildSubmissionsCsv(
  activity: { title: string; max_score: number | null },
  rows: SubmissionWithStudent[],
): string {
  const data = rows.map((s) => ({
    Estudiante: s.student?.full_name ?? "—",
    Email: s.student?.email ?? "—",
    Estado: SUBMISSION_STATUS_LABEL[s.status],
    "Puntaje automático": s.auto_score ?? "",
    "Puntaje docente": s.score ?? "",
    "Puntaje final": effectiveScore(s) ?? "",
    "Puntaje máximo": activity.max_score ?? 10,
    "Tiempo dedicado": formatDuration(s.time_spent_seconds),
    "Segundos dedicados": s.time_spent_seconds,
    Iniciada: formatDateTime(s.started_at),
    Entregada: s.submitted_at ? formatDateTime(s.submitted_at) : "",
    Corregida: s.graded_at ? formatDateTime(s.graded_at) : "",
    "Feedback docente": s.teacher_feedback_md ?? "",
  }));
  const csv = Papa.unparse(data, { delimiter: ";", newline: "\r\n" });
  return `\uFEFF${csv}`;
}

export function csvFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `entregas-${slug || "actividad"}.csv`;
}

import { z } from "zod";
import type { Json } from "@/lib/types/database";

export const REPORT_SCOPES = ["uso_curso", "dificultades", "consultas", "actividad", "estudiante", "clase"] as const;
export type ReportScope = (typeof REPORT_SCOPES)[number];

export const REPORT_SCOPE_LABEL: Record<ReportScope, string> = {
  uso_curso: "Uso del campus",
  dificultades: "Dificultades de los estudiantes",
  consultas: "Consultas y dudas",
  actividad: "Actividades y entregas",
  estudiante: "Un estudiante",
  clase: "Una clase",
};

export const REPORT_SCOPE_DESCRIPTION: Record<ReportScope, string> = {
  uso_curso: "Quiénes entran, cuándo y qué usan: uso diario, contenidos más vistos, participación.",
  dificultades: "Check-ins de dificultad por clase, comentarios, placas que más cuestan y estudiantes en riesgo.",
  consultas: "Temas con más preguntas, consultas sin responder y qué se repite.",
  actividad: "Tasa de entrega, puntajes y tiempos por actividad (o de una actividad en particular).",
  estudiante: "Trayectoria completa de un estudiante: uso, entregas, dificultades y consultas.",
  clase: "Cómo funcionó una clase: grabación, placas, dificultad, consultas y encuestas.",
};

/** report_requests.filters — siempre parcial; cada scope usa lo que necesita. */
export const reportFiltersSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  class_id: z.guid().optional(),
  activity_id: z.guid().optional(),
  student_id: z.guid().optional(),
  question: z.string().trim().max(600).optional(),
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export function parseReportFilters(raw: Json | null | undefined): ReportFilters {
  const parsed = reportFiltersSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function isReportScope(value: string): value is ReportScope {
  return (REPORT_SCOPES as readonly string[]).includes(value);
}

/** Rango efectivo de fechas: por defecto los últimos 30 días. */
export function resolveRange(filters: ReportFilters, defaultDays = 30): { from: string; to: string } {
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`) : new Date();
  const from = filters.from
    ? new Date(`${filters.from}T00:00:00`)
    : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

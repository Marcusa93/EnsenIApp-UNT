"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Check, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import type { Enums, Tables } from "@/lib/types/helpers";
import { resolveAlert } from "./actions";
import type { AlertRow } from "./dashboard-data";

const KIND_LABEL: Record<Enums<"alert_kind">, string> = {
  dificultad_reiterada: "Dificultad reiterada",
  bajo_desempeno: "Bajo desempeño",
  inactividad: "Inactividad",
  consulta_sin_responder: "Consulta sin responder",
};

const KIND_TONE: Record<Enums<"alert_kind">, "warning" | "danger" | "muted" | "accent-2"> = {
  dificultad_reiterada: "warning",
  bajo_desempeno: "danger",
  inactividad: "muted",
  consulta_sin_responder: "accent-2",
};

export interface AlertsPanelProps {
  courseId: string;
  initialAlerts: AlertRow[];
}

/**
 * Alertas automáticas sin resolver. Se suscribe por Realtime a nuevas filas de
 * `teacher_alerts` del curso y permite resolverlas con una Server Action.
 */
export function AlertsPanel({ courseId, initialAlerts }: AlertsPanelProps) {
  const [alerts, setAlerts] = React.useState<AlertRow[]>(initialAlerts);
  const [resolving, setResolving] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);

  // Sincroniza con los datos del servidor tras un router.refresh()
  // (patrón "ajustar estado durante el render", sin efecto).
  const [prevInitial, setPrevInitial] = React.useState(initialAlerts);
  if (prevInitial !== initialAlerts) {
    setPrevInitial(initialAlerts);
    setAlerts(initialAlerts);
  }

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`teacher-alerts:${courseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "teacher_alerts", filter: `course_id=eq.${courseId}` },
        async (payload) => {
          const row = payload.new as Tables<"teacher_alerts">;
          if (row.resolved) return;
          let student: AlertRow["student"] = null;
          if (row.student_id) {
            const { data } = await supabase.from("profiles").select("full_name").eq("id", row.student_id).maybeSingle();
            student = data ?? null;
          }
          setAlerts((prev) => (prev.some((a) => a.id === row.id) ? prev : [{ ...row, student }, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teacher_alerts", filter: `course_id=eq.${courseId}` },
        (payload) => {
          const row = payload.new as Tables<"teacher_alerts">;
          if (row.resolved) setAlerts((prev) => prev.filter((a) => a.id !== row.id));
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [courseId]);

  const onResolve = async (id: string) => {
    setError(null);
    setResolving((s) => new Set(s).add(id));
    const res = await resolveAlert(id);
    setResolving((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Card className="relative overflow-hidden" highlight={alerts.length > 0}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle eyebrow="Seguimiento">Alertas sin resolver</CardTitle>
          <CardDescription>Señales automáticas: dificultad reiterada, bajo desempeño, consultas.</CardDescription>
        </div>
        <Badge tone={live ? "success" : "muted"} dot live={live} aria-live="polite">
          {live ? "En vivo" : "Conectando"}
        </Badge>
      </CardHeader>

      {error && (
        <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      {alerts.length === 0 ? (
        <EmptyState
          compact
          tone="accent-2"
          icon={ShieldCheck}
          title="Todo en orden"
          description="No hay alertas pendientes. Cuando el sistema detecte algo, va a aparecer acá al instante."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Alertas">
          <AnimatePresence initial={false}>
            {alerts.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3"
              >
                <span className="mt-0.5 text-warning [&>svg]:size-4" aria-hidden>
                  <BellRing />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[a.kind]} size="sm">
                      {KIND_LABEL[a.kind]}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted">{formatRelative(a.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-snug">
                    {a.student_id ? (
                      <Link
                        href={`/campus/docente/estudiantes/${a.student_id}`}
                        className="font-medium hover:text-accent hover:underline"
                      >
                        {a.student?.full_name ?? "Estudiante"}
                      </Link>
                    ) : (
                      <span className="font-medium">Curso</span>
                    )}
                    <span className="text-muted"> · {a.message}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={resolving.has(a.id)}
                  onClick={() => onResolve(a.id)}
                  leftIcon={<Check />}
                  aria-label={`Resolver alerta de ${a.student?.full_name ?? "curso"}`}
                >
                  Resolver
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

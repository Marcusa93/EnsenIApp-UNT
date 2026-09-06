"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CheckCheck, Inbox, Lock, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, EmptyState, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { ActivityTypeBadge, SubmissionStatusBadge } from "@/components/activities/badges";
import { Countdown } from "@/components/activities/countdown";
import { formatScore } from "@/components/activities/model";
import type { ActivityStatus, ActivityType, SubmissionStatus } from "@/components/activities/model";

/** Fila liviana y serializable (sin content ni answers: acá no hacen falta). */
export interface StudentActivityItem {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  due_at: string | null;
  max_score: number | null;
  class_topic: string | null;
  submission: {
    status: SubmissionStatus;
    score: number | null;
    auto_score: number | null;
    submitted_at: string | null;
    graded_at: string | null;
  } | null;
}

type Tab = "pendientes" | "entregadas" | "corregidas";

function isTab(v: string | undefined): v is Tab {
  return v === "pendientes" || v === "entregadas" || v === "corregidas";
}

function tabOf(row: StudentActivityItem): Tab {
  if (row.submission?.status === "corregida") return "corregidas";
  if (row.submission?.status === "entregada") return "entregadas";
  return "pendientes";
}

const EMPTY_COPY: Record<Tab, { icon: LucideIcon; title: string; description: string }> = {
  pendientes: {
    icon: Inbox,
    title: "No tenés actividades pendientes",
    description: "Cuando el equipo docente publique algo nuevo, lo vas a ver acá. ¡Aprovechá para repasar!",
  },
  entregadas: {
    icon: CheckCheck,
    title: "Todavía no entregaste ninguna actividad",
    description: "Cuando entregues, acá vas a poder seguir el estado de la corrección.",
  },
  corregidas: {
    icon: Sparkles,
    title: "Todavía no hay correcciones",
    description: "Cuando el equipo docente corrija tus entregas, acá vas a ver el puntaje y el feedback.",
  },
};

export function StudentActivitiesList({
  rows,
  initialTab,
}: {
  rows: StudentActivityItem[];
  initialTab?: string;
}) {
  const [tab, setTab] = React.useState<Tab>(isTab(initialTab) ? initialTab : "pendientes");

  const byTab = React.useMemo(() => {
    const groups: Record<Tab, StudentActivityItem[]> = { pendientes: [], entregadas: [], corregidas: [] };
    rows.forEach((r) => groups[tabOf(r)].push(r));
    // Pendientes: primero lo que vence antes; sin fecha al final; cerradas al fondo.
    groups.pendientes.sort((a, b) => {
      if ((a.status === "closed") !== (b.status === "closed")) return a.status === "closed" ? 1 : -1;
      const ta = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const tb = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      return ta - tb;
    });
    const byDateDesc = (key: "submitted_at" | "graded_at") => (a: StudentActivityItem, b: StudentActivityItem) =>
      new Date(b.submission?.[key] ?? 0).getTime() - new Date(a.submission?.[key] ?? 0).getTime();
    groups.entregadas.sort(byDateDesc("submitted_at"));
    groups.corregidas.sort(byDateDesc("graded_at"));
    return groups;
  }, [rows]);

  const visible = byTab[tab];
  const empty = EMPTY_COPY[tab];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(isTab(v) ? v : "pendientes")} variant="pills">
        <TabsList aria-label="Filtrar actividades" className="w-full sm:w-fit">
          <TabsTrigger value="pendientes" icon={<Inbox />} count={byTab.pendientes.length} className="h-10 flex-1 sm:flex-none">
            Pendientes
          </TabsTrigger>
          <TabsTrigger value="entregadas" icon={<CheckCheck />} count={byTab.entregadas.length} className="h-10 flex-1 sm:flex-none">
            Entregadas
          </TabsTrigger>
          <TabsTrigger value="corregidas" icon={<Sparkles />} count={byTab.corregidas.length} className="h-10 flex-1 sm:flex-none">
            Corregidas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState compact tone="muted" icon={empty.icon} title={empty.title} description={empty.description} />
      ) : (
        <ul className="flex flex-col gap-2.5" aria-label="Actividades">
          {visible.map((r, i) => {
            const closedWithoutSubmit = tab === "pendientes" && r.status === "closed";
            const score = r.submission ? (r.submission.score ?? r.submission.auto_score) : null;
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
              >
                <Link
                  href={`/campus/estudiante/actividades/${r.id}`}
                  className="paper group flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_18px_40px_-24px_var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <ActivityTypeBadge type={r.type} size="sm" />
                      {closedWithoutSubmit && (
                        <Badge tone="muted" size="sm">
                          <Lock className="size-3" aria-hidden /> Cerrada
                        </Badge>
                      )}
                      {tab !== "pendientes" && <SubmissionStatusBadge status={r.submission?.status} size="sm" />}
                    </div>
                    <p className="truncate font-display text-[15px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-accent">
                      {r.title}
                    </p>
                    {r.class_topic && <p className="mt-0.5 truncate text-xs text-muted">{r.class_topic}</p>}
                  </div>

                  <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:gap-1">
                    {tab === "pendientes" && !closedWithoutSubmit && <Countdown dueAt={r.due_at} />}
                    {tab === "entregadas" && r.submission?.submitted_at && (
                      <span className="text-xs text-muted" title={formatDateTime(r.submission.submitted_at)}>
                        Entregada {formatRelative(r.submission.submitted_at)}
                      </span>
                    )}
                    {tab === "corregidas" && (
                      <span className="font-mono text-sm font-medium tabular-nums text-accent-2">
                        {formatScore(score, r.max_score)}
                      </span>
                    )}
                    {tab === "corregidas" && r.submission?.graded_at && (
                      <span className="text-[11px] text-muted" title={formatDateTime(r.submission.graded_at)}>
                        corregida {formatRelative(r.submission.graded_at)}
                      </span>
                    )}
                  </div>

                  <ArrowRight
                    className="hidden size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent sm:block"
                    aria-hidden
                  />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CalendarDays, Paperclip, PlayCircle, SearchX, UserRound } from "lucide-react";
import { Badge, Card, EmptyState, Select } from "@/components/ui";
import { TIME_ZONE, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClassListItem, ClassTemporalState } from "../_lib/data";

type Filter = "todas" | "grabadas" | "proximas" | "pasadas";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "grabadas", label: "Con grabación" },
  { value: "proximas", label: "Próximas" },
  { value: "pasadas", label: "Pasadas" },
];

const STATE_BADGE: Record<ClassTemporalState, { label: string; tone: "accent-2" | "accent" | "muted"; live?: boolean } | null> = {
  hoy: { label: "Hoy", tone: "accent-2", live: true },
  proxima: { label: "Próxima", tone: "accent" },
  futura: null,
  pasada: { label: "Pasada", tone: "muted" },
};

const monthFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, day: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, weekday: "short" });

/** Mediodía en Tucumán para que la `date` de Postgres no cambie de día al formatear. */
function localNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00-03:00`);
}

function matches(c: ClassListItem, filter: Filter): boolean {
  switch (filter) {
    case "grabadas":
      return c.recordings_count > 0;
    case "proximas":
      return c.state !== "pasada";
    case "pasadas":
      return c.state === "pasada";
    default:
      return true;
  }
}

export function ClassTimeline({ classes, courses }: { classes: ClassListItem[]; courses: { id: string; name: string }[] }) {
  const [filter, setFilter] = React.useState<Filter>("todas");
  const [courseId, setCourseId] = React.useState<string>("all");
  const filterId = React.useId();

  const visible = React.useMemo(
    () => classes.filter((c) => matches(c, filter) && (courseId === "all" || c.course_id === courseId)),
    [classes, filter, courseId],
  );

  const groups = React.useMemo(() => {
    const map = new Map<string, { label: string; items: ClassListItem[] }>();
    for (const c of visible) {
      const key = c.class_date.slice(0, 7);
      const g = map.get(key) ?? { label: monthFmt.format(localNoon(c.class_date)), items: [] };
      g.items.push(c);
      map.set(key, g);
    }
    return Array.from(map, ([key, g]) => ({ key, ...g }));
  }, [visible]);

  const firstActiveId = classes.find((c) => c.state === "hoy" || c.state === "proxima")?.id ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-labelledby={filterId} className="flex flex-wrap gap-2">
          <span id={filterId} className="sr-only">
            Filtrar clases
          </span>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "h-9 rounded-full border px-3.5 font-mono text-[11px] uppercase tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border bg-surface text-muted hover:border-accent/50 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {courses.length > 1 && (
          <div className="sm:w-64">
            <Select
              aria-label="Comisión"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              options={[{ value: "all", label: "Todas las comisiones" }, ...courses.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "clase" : "clases"}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          compact
          tone="muted"
          icon={SearchX}
          title="No hay clases con ese filtro"
          description={filter === "grabadas" ? "Cuando el equipo docente publique una grabación, va a aparecer acá." : "Probá con otro filtro."}
        />
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
          {groups.map((g) => (
            <motion.section
              key={g.key}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              aria-labelledby={`month-${g.key}`}
            >
              <h2 id={`month-${g.key}`} className="eyebrow mb-3 capitalize">
                {g.label}
              </h2>
              <ol className="relative ml-3 border-l border-border pl-6 sm:ml-4">
                {g.items.map((c) => {
                  const badge = STATE_BADGE[c.state];
                  const isActive = c.id === firstActiveId;
                  const d = localNoon(c.class_date);
                  return (
                    <li key={c.id} className="relative pb-4 last:pb-0">
                      <span
                        className={cn(
                          "absolute -left-[31px] top-5 flex size-3 items-center justify-center rounded-full border-2 border-background sm:-left-[31px]",
                          c.state === "hoy"
                            ? "bg-accent-2 shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-2)_25%,transparent)]"
                            : c.state === "proxima"
                              ? "bg-accent"
                              : c.state === "pasada"
                                ? "bg-border"
                                : "bg-surface-2 ring-1 ring-border",
                        )}
                        aria-hidden
                      />
                      <Link
                        href={`/campus/estudiante/clases/${c.id}`}
                        className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-label={`${c.topic}, ${formatDate(c.class_date)}`}
                      >
                        <Card interactive highlight={isActive} padding="sm" className={cn("flex gap-4", c.state === "pasada" && !isActive && "opacity-90")}>
                          <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface-2/60 py-1.5">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{weekdayFmt.format(d).replace(".", "")}</span>
                            <span className="text-xl font-semibold tabular-nums leading-none">{dayFmt.format(d)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {badge && (
                                <Badge size="sm" tone={badge.tone} dot={Boolean(badge.live)} live={badge.live}>
                                  {badge.label}
                                </Badge>
                              )}
                              {courses.length > 1 && (
                                <Badge size="sm" tone="muted">
                                  {c.course_name}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-balance text-base font-semibold leading-snug tracking-tight group-hover:text-accent-2">
                              {c.topic}
                            </h3>
                            {c.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>}
                            <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="size-3.5 text-accent-2" aria-hidden />
                                <dt className="sr-only">Fecha</dt>
                                <dd className="font-mono">{formatDate(c.class_date)}</dd>
                              </div>
                              {c.teacher && (
                                <div className="flex items-center gap-1.5">
                                  <UserRound className="size-3.5 text-accent-2" aria-hidden />
                                  <dt className="sr-only">Docente</dt>
                                  <dd className="truncate">{c.teacher.full_name}</dd>
                                </div>
                              )}
                              <div className={cn("flex items-center gap-1.5", c.recordings_count > 0 ? "text-success" : "")}>
                                <PlayCircle className="size-3.5" aria-hidden />
                                <dt className="sr-only">Grabación</dt>
                                <dd>
                                  {c.recordings_count > 0
                                    ? c.recordings_count === 1
                                      ? "Grabación publicada"
                                      : `${c.recordings_count} grabaciones`
                                    : "Sin grabación"}
                                </dd>
                              </div>
                              {c.materials_count > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Paperclip className="size-3.5" aria-hidden />
                                  <dt className="sr-only">Materiales</dt>
                                  <dd>
                                    {c.materials_count} {c.materials_count === 1 ? "material" : "materiales"}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                          <ArrowRight className="mt-1 hidden size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-2 sm:block" aria-hidden />
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </motion.section>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

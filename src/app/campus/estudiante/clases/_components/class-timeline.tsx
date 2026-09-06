"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CalendarDays, NotebookText, Paperclip, PlayCircle, SearchX, UserRound } from "lucide-react";
import { Badge, Card, EmptyState, Select } from "@/components/ui";
import { TIME_ZONE, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClassListItem, ClassTemporalState } from "../_lib/data";

type Filter = "todas" | "con-material" | "proximas" | "pasadas";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "con-material", label: "Con contenido" },
  { value: "proximas", label: "Próximas" },
  { value: "pasadas", label: "Pasadas" },
];

const STATE_BADGE: Record<ClassTemporalState, { label: string; tone: "accent-2" | "accent" | "muted"; live?: boolean } | null> = {
  hoy: { label: "Hoy", tone: "accent-2", live: true },
  proxima: { label: "Próxima", tone: "accent" },
  futura: null,
  pasada: { label: "Pasada", tone: "muted" },
};

/** Sello de fecha: hoy en verde petróleo (en vivo), la próxima en carmesí, el resto en papel. */
const DAY_TONE: Record<ClassTemporalState, { box: string; label: string; num: string }> = {
  hoy: { box: "border-accent-2/40 bg-accent-2/10", label: "text-accent-2", num: "text-accent-2" },
  proxima: { box: "border-accent/40 bg-accent/8", label: "text-accent", num: "text-accent" },
  futura: { box: "border-border bg-surface-2/60", label: "text-muted", num: "text-foreground" },
  pasada: { box: "border-border bg-surface-2/60", label: "text-muted", num: "text-muted" },
};

/** Punto sobre la línea de tiempo. */
const DOT: Record<ClassTemporalState, string> = {
  hoy: "bg-accent-2 shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-2)_25%,transparent)]",
  proxima: "bg-accent",
  futura: "bg-surface-2 ring-1 ring-border",
  pasada: "bg-border",
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
    case "con-material":
      // Grabación o apunte: para el que estudia, las dos son contenido.
      return c.recordings_count > 0 || c.has_note;
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
        {/* Filtros como segmento: en el celular desborda con scroll horizontal (sin barra) en vez de partirse. */}
        <div
          role="radiogroup"
          aria-labelledby={filterId}
          className="flex w-full min-w-0 gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto"
        >
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
                  "relative h-9 shrink-0 whitespace-nowrap rounded-lg px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`${filterId}-indicador`}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute inset-0 rounded-lg bg-surface shadow-sm"
                    aria-hidden
                  />
                )}
                <span className="relative">{f.label}</span>
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
          description={
            filter === "con-material"
              ? "Cuando el equipo docente publique una grabación o el apunte de una clase, va a aparecer acá."
              : "Probá con otro filtro."
          }
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
              {/* Cabecera de mes: etiqueta, regla fina y conteo (dato, en mono). */}
              <div className="mb-3 flex items-center gap-3">
                <h2 id={`month-${g.key}`} className="eyebrow capitalize">
                  {g.label}
                </h2>
                <span className="h-px min-w-0 flex-1 bg-border" aria-hidden />
                <span className="font-mono text-[11px] tabular-nums text-muted" aria-hidden>
                  {g.items.length}
                </span>
              </div>
              <ol className="relative ml-3 border-l border-border pl-6 sm:ml-4">
                {g.items.map((c) => {
                  const badge = STATE_BADGE[c.state];
                  const isActive = c.id === firstActiveId;
                  const d = localNoon(c.class_date);
                  const dayTone = DAY_TONE[c.state];
                  return (
                    <li key={c.id} className="relative pb-4 last:pb-0">
                      <span
                        className={cn(
                          "absolute -left-[31px] top-5 flex size-3 items-center justify-center rounded-full border-2 border-background",
                          DOT[c.state],
                        )}
                        aria-hidden
                      />
                      <Link
                        href={`/campus/estudiante/clases/${c.id}`}
                        className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-label={`${c.topic}, ${formatDate(c.class_date)}`}
                      >
                        <Card
                          interactive
                          highlight={isActive}
                          padding="sm"
                          className={cn("flex gap-3 sm:gap-4", c.state === "pasada" && !isActive && "opacity-90")}
                        >
                          {/* Sello de fecha */}
                          <div
                            className={cn(
                              "flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border py-1.5",
                              dayTone.box,
                            )}
                          >
                            <span className={cn("font-display text-[9px] font-bold uppercase tracking-[0.12em]", dayTone.label)}>
                              {weekdayFmt.format(d).replace(".", "")}
                            </span>
                            <span className={cn("display-num mt-0.5 text-xl leading-none", dayTone.num)}>{dayFmt.format(d)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {badge && (
                                <Badge size="sm" tone={badge.tone} dot={Boolean(badge.live)} live={badge.live}>
                                  {badge.label}
                                </Badge>
                              )}
                              {courses.length > 1 && (
                                <Badge size="sm" tone="muted" className="max-w-full">
                                  <span className="truncate">{c.course_name}</span>
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-balance text-[15px] font-bold leading-snug tracking-tight transition-colors group-hover:text-accent sm:text-base">
                              {c.topic}
                            </h3>
                            {c.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>}
                            <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                              <div className="flex items-center gap-1.5">
                                <CalendarDays className="size-3.5 text-accent-2" aria-hidden />
                                <dt className="sr-only">Fecha</dt>
                                <dd className="font-mono tabular-nums">{formatDate(c.class_date)}</dd>
                              </div>
                              {c.teacher && (
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <UserRound className="size-3.5 shrink-0" aria-hidden />
                                  <dt className="sr-only">Docente</dt>
                                  <dd className="truncate">{c.teacher.full_name}</dd>
                                </div>
                              )}
                              {c.recordings_count > 0 ? (
                                <div className="flex items-center gap-1.5 text-success">
                                  <PlayCircle className="size-3.5" aria-hidden />
                                  <dt className="sr-only">Grabación</dt>
                                  <dd>
                                    {c.recordings_count === 1 ? "Grabación publicada" : `${c.recordings_count} grabaciones`}
                                  </dd>
                                </div>
                              ) : c.has_note ? (
                                /* Sin grabación pero con apunte: la clase tiene contenido igual. */
                                <div className="flex items-center gap-1.5 text-accent">
                                  <NotebookText className="size-3.5" aria-hidden />
                                  <dt className="sr-only">Apunte</dt>
                                  <dd>Apunte de clase</dd>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <PlayCircle className="size-3.5" aria-hidden />
                                  <dt className="sr-only">Grabación</dt>
                                  <dd>Sin grabación</dd>
                                </div>
                              )}
                              {c.materials_count > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Paperclip className="size-3.5" aria-hidden />
                                  <dt className="sr-only">Materiales</dt>
                                  <dd>
                                    <span className="font-mono tabular-nums">{c.materials_count}</span>{" "}
                                    {c.materials_count === 1 ? "material" : "materiales"}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                          <ArrowRight
                            className="mt-1 hidden size-4 shrink-0 text-muted transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-accent sm:block"
                            aria-hidden
                          />
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

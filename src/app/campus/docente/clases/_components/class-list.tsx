"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, FileSpreadsheet, Gauge, List, Paperclip, Pencil, Plus, Rows3, Trash2 } from "lucide-react";
import { Badge, Button, Dialog, EmptyState, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { RecordingStatusBadge } from "@/components/docente/recording-status-badge";
import type { StaffOption, TeacherClassRow } from "@/components/docente/class-data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClassFormDialog, type ClassFormValues } from "./class-form-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { deleteClass } from "../actions";

export interface ClassListProps {
  courseId: string;
  classes: TeacherClassRow[];
  staff: StaffOption[];
}

const STATE_LABEL: Record<TeacherClassRow["state"], { label: string; tone: "muted" | "accent" | "accent-2" | "success" }> = {
  pasada: { label: "Dictada", tone: "muted" },
  hoy: { label: "Hoy", tone: "accent-3" as "accent" },
  proxima: { label: "Próxima", tone: "accent" },
  futura: { label: "Programada", tone: "accent-2" },
};

const monthFmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("es-AR", { day: "2-digit", timeZone: "UTC" });
const weekdayFmt = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" });

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Cronograma del docente: timeline/lista con estado de grabación, check-ins, alta/edición/baja e importación CSV. */
export function ClassList({ courseId, classes, staff }: ClassListProps) {
  const router = useRouter();
  const [view, setView] = React.useState<"timeline" | "list">("timeline");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ClassFormValues | null>(null);
  const [csvOpen, setCsvOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<TeacherClassRow | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: TeacherClassRow) => {
    setEditing({
      id: c.id,
      class_date: c.class_date,
      topic: c.topic,
      teacher_id: c.teacher_id,
      teacher_name: c.teacher_name,
      summary: c.summary,
      sort_order: c.sort_order,
    });
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteClass(toDelete.id);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      setToDelete(null);
      router.refresh();
    });
  };

  const groups = React.useMemo(() => {
    const map = new Map<string, TeacherClassRow[]>();
    for (const c of classes) {
      const key = c.class_date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return Array.from(map, ([key, rows]) => ({ key, label: monthFmt.format(ymdToDate(`${key}-01`)), rows }));
  }, [classes]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v === "list" ? "list" : "timeline")} variant="pills">
          <TabsList aria-label="Vista del cronograma">
            <TabsTrigger value="timeline" icon={<Rows3 />}>
              Timeline
            </TabsTrigger>
            <TabsTrigger value="list" icon={<List />}>
              Lista
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leftIcon={<FileSpreadsheet />} onClick={() => setCsvOpen(true)}>
            Importar CSV
          </Button>
          <Button leftIcon={<Plus />} onClick={openCreate}>
            Nueva clase
          </Button>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="El cronograma está vacío"
          description="Cargá las clases una por una o importá todo el cuatrimestre desde un CSV. Los estudiantes lo ven al instante."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" leftIcon={<FileSpreadsheet />} onClick={() => setCsvOpen(true)}>
                Importar CSV
              </Button>
              <Button leftIcon={<Plus />} onClick={openCreate}>
                Crear la primera clase
              </Button>
            </div>
          }
        />
      ) : view === "timeline" ? (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className="eyebrow mb-3 capitalize">{g.label}</h2>
              <ol className="relative flex flex-col gap-3 border-l border-border pl-5 sm:pl-6">
                <AnimatePresence initial={false}>
                  {g.rows.map((c) => (
                    <ClassTimelineItem key={c.id} row={c} onEdit={() => openEdit(c)} onDelete={() => setToDelete(c)} />
                  ))}
                </AnimatePresence>
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border font-mono text-[11px] uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tema</th>
                <th className="px-4 py-3">Docente</th>
                <th className="px-4 py-3">Grabación</th>
                <th className="px-4 py-3 text-right">Check-ins</th>
                <th className="px-4 py-3 text-right">Mat.</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.map((c) => (
                <tr key={c.id} className="group hover:bg-surface-2/50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{formatDate(c.class_date)}</td>
                  <td className="max-w-[20rem] px-4 py-3">
                    <Link href={`/campus/docente/clases/${c.id}`} className="line-clamp-2 font-medium hover:text-accent">
                      {c.topic}
                    </Link>
                  </td>
                  <td className="truncate px-4 py-3 text-muted">{c.teacher_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <RecordingStatusBadge status={c.recording?.status} published={c.recording?.published} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{c.checkins_count}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{c.materials_count}</td>
                  <td className="px-2 py-2">
                    <RowActions onEdit={() => openEdit(c)} onDelete={() => setToDelete(c)} topic={c.topic} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClassFormDialog open={formOpen} onOpenChange={setFormOpen} courseId={courseId} staff={staff} initial={editing} />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} courseId={courseId} />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(o) => !pending && !o && setToDelete(null)}
        title="Eliminar clase"
        description="Se borran también sus grabaciones, materiales, avisos y check-ins. Esta acción no se puede deshacer."
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={pending} leftIcon={<Trash2 />}>
              Eliminar
            </Button>
          </>
        }
      >
        {toDelete && (
          <p className="text-sm">
            <span className="font-mono text-xs text-muted">{formatDate(toDelete.class_date)}</span>
            <br />
            <span className="font-medium">{toDelete.topic}</span>
          </p>
        )}
        {deleteError && (
          <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {deleteError}
          </p>
        )}
      </Dialog>
    </>
  );
}

function RowActions({ onEdit, onDelete, topic }: { onEdit: () => void; onDelete: () => void; topic: string }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label={`Editar ${topic}`}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 hover:text-danger"
        onClick={onDelete}
        aria-label={`Eliminar ${topic}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function ClassTimelineItem({ row, onEdit, onDelete }: { row: TeacherClassRow; onEdit: () => void; onDelete: () => void }) {
  const d = ymdToDate(row.class_date);
  const state = STATE_LABEL[row.state];
  const isLive = row.state === "hoy";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <span
        className={cn(
          "absolute -left-[1.35rem] top-5 size-2.5 rounded-full border-2 border-background sm:-left-[1.6rem]",
          row.state === "pasada" ? "bg-muted" : isLive ? "bg-accent-3 animate-pulse-ring" : "bg-accent",
        )}
        aria-hidden
      />
      <div
        className={cn(
          "group flex gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/50",
          isLive && "border-accent-3/40 glow",
        )}
      >
        <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface-2/70 py-1.5 font-mono">
          <span className="text-[10px] uppercase tracking-widest text-muted">{weekdayFmt.format(d).replace(".", "")}</span>
          <span className="text-lg font-semibold tabular-nums leading-tight">{dayFmt.format(d)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={state.tone} size="sm" dot={isLive} live={isLive}>
              {state.label}
            </Badge>
            <RecordingStatusBadge status={row.recording?.status} published={row.recording?.published} />
          </div>
          <Link
            href={`/campus/docente/clases/${row.id}`}
            className="mt-1.5 block text-base font-semibold leading-snug tracking-tight hover:text-accent"
          >
            {row.topic}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{row.teacher_name ?? "Sin docente asignado"}</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Gauge className="size-3.5" aria-hidden /> {row.checkins_count} check-ins
            </span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Paperclip className="size-3.5" aria-hidden /> {row.materials_count}
            </span>
          </p>
        </div>
        <div className="hidden shrink-0 items-start sm:flex">
          <RowActions onEdit={onEdit} onDelete={onDelete} topic={row.topic} />
        </div>
      </div>
      <div className="mt-1 flex justify-end sm:hidden">
        <RowActions onEdit={onEdit} onDelete={onDelete} topic={row.topic} />
      </div>
    </motion.li>
  );
}

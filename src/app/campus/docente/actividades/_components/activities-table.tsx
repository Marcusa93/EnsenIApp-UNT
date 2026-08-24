"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Lock, Search, Send } from "lucide-react";
import { Button, Input, Select, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { ActivityStatusBadge, ActivityTypeBadge } from "@/components/activities/badges";
import { ACTIVITY_TYPE_LABEL, type ActivityStatus, type ActivityType } from "@/components/activities/model";
import type { TeacherActivityRow } from "@/components/activities/queries";
import { setActivityStatus } from "../actions";

type Filter = "todas" | ActivityStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "published", label: "Publicadas" },
  { key: "draft", label: "Borradores" },
  { key: "closed", label: "Cerradas" },
];

function isFilter(v: string | undefined): v is Filter {
  return v === "todas" || v === "draft" || v === "published" || v === "closed";
}

export function ActivitiesTable({ rows, initialFilter }: { rows: TeacherActivityRow[]; initialFilter?: string }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>(isFilter(initialFilter) ? initialFilter : "todas");
  const [type, setType] = React.useState<"" | ActivityType>("");
  const [query, setQuery] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { todas: rows.length, draft: 0, published: 0, closed: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (filter === "todas" || r.status === filter) &&
      (!type || r.type === type) &&
      (!q || r.title.toLowerCase().includes(q) || (r.class?.topic ?? "").toLowerCase().includes(q)),
  );

  const changeStatus = (id: string, status: ActivityStatus) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await setActivityStatus(id, status);
      if (!res.ok) setError(res.error);
      else router.refresh();
      setBusyId(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(isFilter(v) ? v : "todas")} variant="pills">
          <TabsList aria-label="Filtrar por estado">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} count={counts[f.key]}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Input
            leftIcon={<Search />}
            placeholder="Buscar por título o clase…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar actividades"
            className="h-10"
          />
          <Select
            aria-label="Filtrar por tipo"
            value={type}
            onChange={(e) => setType(e.target.value as "" | ActivityType)}
            className="w-44 shrink-0 [&>select]:h-10"
            options={[
              { value: "", label: "Todos los tipos" },
              ...(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((t) => ({ value: t, label: ACTIVITY_TYPE_LABEL[t] })),
            ]}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          No hay actividades que coincidan con el filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Actividades">
          {visible.map((r, i) => {
            const ratio = r.assigned_count > 0 ? Math.round((r.submitted_count / r.assigned_count) * 100) : 0;
            const busy = busyId === r.id;
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
                className="group rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <ActivityStatusBadge status={r.status} size="sm" />
                      <ActivityTypeBadge type={r.type} size="sm" />
                    </div>
                    <Link
                      href={`/campus/docente/actividades/${r.id}`}
                      className="block truncate text-sm font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted">
                      {r.class ? `${r.class.topic} · ` : ""}
                      {r.due_at ? `vence ${formatDateTime(r.due_at)}` : "sin fecha límite"}
                      {r.published_at ? ` · publicada ${formatRelative(r.published_at)}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 md:w-56">
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-widest text-muted">
                        <span>Entregas</span>
                        <span className="tabular-nums text-foreground">
                          {r.submitted_count}/{r.assigned_count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div className="h-full rounded-full bg-accent-2 transition-[width]" style={{ width: `${ratio}%` }} />
                      </div>
                      {r.graded_count > 0 && (
                        <p className="mt-1 font-mono text-[10px] text-muted">{r.graded_count} corregidas</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {r.status === "draft" && (
                      <Button size="sm" variant="secondary" leftIcon={<Send />} loading={busy} onClick={() => changeStatus(r.id, "published")}>
                        Publicar
                      </Button>
                    )}
                    {r.status === "published" && (
                      <Button size="sm" variant="secondary" leftIcon={<Lock />} loading={busy} onClick={() => changeStatus(r.id, "closed")}>
                        Cerrar
                      </Button>
                    )}
                    {r.status === "closed" && (
                      <Button size="sm" variant="ghost" loading={busy} onClick={() => changeStatus(r.id, "published")}>
                        Reabrir
                      </Button>
                    )}
                    <Button asChild size="icon" variant="ghost" className="size-9">
                      <Link href={`/campus/docente/actividades/${r.id}`} aria-label={`Abrir ${r.title}`}>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

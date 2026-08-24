"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Download, Search, Users } from "lucide-react";
import { Avatar, Button, EmptyState, Input, Tooltip } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EnrolledStudent } from "./students-data";
import { StudentStatusBadge } from "./status-badge";
import { StatusActions } from "./status-actions";
import { downloadCsv } from "./csv";

export interface EnrolledTableProps {
  courseId: string;
  courseName: string;
  students: EnrolledStudent[];
  usageTruncated: boolean;
}

function difficultyClass(d: number | null) {
  if (d == null) return "text-muted";
  if (d >= 4) return "text-accent-3";
  if (d >= 3) return "text-warning";
  return "text-success";
}

export function EnrolledTable({ courseId, courseName, students, usageTruncated }: EnrolledTableProps) {
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? students.filter((s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    : students;

  const exportCsv = () => {
    downloadCsv(
      `inscriptos-${courseName.replace(/\s+/g, "-").toLowerCase()}.csv`,
      ["nombre", "email", "estado", "en_padron", "ultimo_acceso", "eventos_7d", "dificultad_promedio", "alertas_abiertas"],
      filtered.map((s) => [
        s.full_name,
        s.email,
        s.status,
        s.in_roster ? "si" : "no",
        s.last_seen_at ?? "",
        s.events_7d,
        s.avg_difficulty ?? "",
        s.open_alerts,
      ]),
    );
  };

  if (students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        tone="accent-2"
        title="Todavía no hay inscriptos"
        description="Cargá el padrón para que los estudiantes queden validados e inscriptos automáticamente al entrar con su email."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Buscar por nombre o email"
          placeholder="Buscar por nombre o email…"
          leftIcon={<Search />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            {filtered.length} de {students.length}
          </span>
          <Button variant="secondary" size="sm" leftIcon={<Download />} onClick={exportCsv}>
            Exportar CSV
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState compact tone="muted" icon={Search} title="Sin resultados" description={`Nadie coincide con “${query}”.`} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Estudiante</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">Último acceso</th>
                <th className="px-3 py-3 text-right font-medium">Actividad 7 d</th>
                <th className="px-3 py-3 text-right font-medium">Dificultad</th>
                <th className="px-3 py-3 text-right font-medium">Alertas</th>
                <th className="px-3 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/campus/docente/estudiantes/${s.id}`} className="group flex items-center gap-3">
                      <Avatar name={s.full_name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:text-accent-2">{s.full_name}</span>
                        <span className="block truncate text-xs text-muted">{s.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StudentStatusBadge status={s.status} />
                      {!s.in_roster && (
                        <Tooltip content="No figura en el padrón">
                          <span
                            tabIndex={0}
                            className="font-mono text-[10px] uppercase tracking-widest text-warning"
                            aria-label="No figura en el padrón"
                          >
                            sin padrón
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{s.last_seen_at ? formatRelative(s.last_seen_at) : "Nunca"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{s.events_7d}</td>
                  <td className={cn("px-3 py-2.5 text-right font-mono", difficultyClass(s.avg_difficulty))}>
                    {s.avg_difficulty == null ? "—" : s.avg_difficulty.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {s.open_alerts > 0 ? (
                      <span className="inline-flex items-center gap-1 font-mono text-accent-3">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        {s.open_alerts}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <StatusActions courseId={courseId} studentId={s.id} status={s.status} onError={setError} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {usageTruncated && (
        <p className="text-xs text-muted">La actividad de 7 días se calculó sobre los primeros 20 000 eventos.</p>
      )}
    </div>
  );
}

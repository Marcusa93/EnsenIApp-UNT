"use client";

import * as React from "react";
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { Avatar, Card, EmptyState } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import type { EnrolledStudent } from "./students-data";
import { StatusActions } from "./status-actions";

export interface PendingListProps {
  courseId: string;
  students: EnrolledStudent[];
}

export function PendingList({ courseId, students }: PendingListProps) {
  const [error, setError] = React.useState<string | null>(null);

  if (students.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        tone="accent"
        title="No hay perfiles pendientes"
        description="Todos los inscriptos están validados o figuran en el padrón. Los que entren con un email que no esté en el padrón van a aparecer acá."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Entraron al campus con un email que no está en el padrón. Validalos si corresponden a la comisión, o bloquealos
        si no.
      </p>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="stagger grid gap-3 sm:grid-cols-2">
        {students.map((s) => (
          <li key={s.id}>
            <Card padding="sm" className="flex h-full flex-col gap-3">
              <Link href={`/campus/docente/estudiantes/${s.id}`} className="group flex items-center gap-3">
                <Avatar name={s.full_name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-medium group-hover:text-accent-2">{s.full_name}</span>
                  <span className="block truncate text-xs text-muted">{s.email}</span>
                </span>
              </Link>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
                Inscripto {formatRelative(s.enrolled_at)} · {s.last_seen_at ? `visto ${formatRelative(s.last_seen_at)}` : "sin accesos"}
              </p>
              <StatusActions courseId={courseId} studentId={s.id} status={s.status} size="md" onError={setError} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import type { LiveSession } from "@/lib/live/types";
import { formatDateTime } from "@/lib/format";
import { createLiveSession } from "../actions";

export interface SessionsPanelProps {
  classId: string;
  sessions: LiveSession[];
  hasPrompts: boolean;
}

const STATUS_BADGE: Record<LiveSession["status"], { label: string; tone: "muted" | "accent-2" | "warning" }> = {
  draft: { label: "Borrador", tone: "warning" },
  live: { label: "En vivo", tone: "accent-2" },
  ended: { label: "Finalizada", tone: "muted" },
};

export function SessionsPanel({ classId, sessions, hasPrompts }: SessionsPanelProps) {
  const router = useRouter();
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function start() {
    setError(null);
    setStarting(true);
    (async () => {
      const res = await createLiveSession({ classId });
      setStarting(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/campus/docente/vivo/${res.data.sessionId}`);
    })();
  }

  return (
    <Card highlight>
      <CardHeader>
        <CardTitle eyebrow="Ahora en clase">Sesión en vivo</CardTitle>
        <CardDescription>
          Generá un link único: cualquiera que lo abra queda en la sala, esperando a que actives la primera pregunta.
        </CardDescription>
      </CardHeader>

      {error && (
        <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Button onClick={start} loading={starting} disabled={!hasPrompts} leftIcon={<Radio />} className="w-full sm:w-auto">
        Iniciar sesión en vivo
      </Button>
      {!hasPrompts && <p className="mt-2 text-xs text-muted">Agregá al menos una disparadora para poder arrancar.</p>}

      {sessions.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-4" aria-label="Sesiones anteriores">
          {sessions.map((s) => {
            const badge = STATUS_BADGE[s.status];
            return (
              <li key={s.id}>
                <Link
                  href={`/campus/docente/vivo/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-3 transition hover:border-accent/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Sparkles className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="truncate font-mono text-sm">{s.code}</span>
                    <span className="hidden text-xs text-muted sm:inline">{formatDateTime(s.created_at)}</span>
                  </span>
                  <Badge tone={badge.tone} size="sm" dot={s.status === "live"} live={s.status === "live"}>
                    {badge.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {sessions.length === 0 && (
        <div className="mt-4">
          <EmptyState compact tone="muted" icon={Radio} title="Sin sesiones todavía" description="La primera que inicies queda acá." />
        </div>
      )}
    </Card>
  );
}

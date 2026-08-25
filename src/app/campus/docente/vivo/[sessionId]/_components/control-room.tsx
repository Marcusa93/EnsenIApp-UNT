"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, ExternalLink, MonitorPlay, Pause, Radio, Square } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { LabBadge } from "@/components/live/lab-badge";
import type { LivePrompt, LiveSession } from "@/lib/live/types";
import { endSession, pauseSession, setActivePrompt } from "../actions";

export interface ControlRoomProps {
  session: Pick<LiveSession, "id" | "code" | "status" | "active_prompt_id">;
  prompts: LivePrompt[];
  joinUrl: string;
  projectorUrl: string;
}

const STATUS_LABEL: Record<LiveSession["status"], { label: string; tone: "warning" | "accent-2" | "muted" }> = {
  draft: { label: "Borrador — todavía nadie ve nada", tone: "warning" },
  live: { label: "En vivo", tone: "accent-2" },
  ended: { label: "Finalizada", tone: "muted" },
};

export function ControlRoom({ session, prompts, joinUrl, projectorUrl }: ControlRoomProps) {
  const [status, setStatus] = React.useState(session.status);
  const [activeId, setActiveId] = React.useState(session.active_prompt_id);
  const [copied, setCopied] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [ending, setEnding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [count, setCount] = React.useState(0);

  async function fetchCount(promptId: string): Promise<number> {
    const supabase = createClient();
    const { count: n } = await supabase
      .from("live_responses")
      .select("id", { count: "exact", head: true })
      .eq("prompt_id", promptId);
    return n ?? 0;
  }

  // Al montar, si ya había una pregunta activa (se reabrió la sala de control),
  // traemos su conteo una sola vez.
  const initialPromptId = React.useRef(session.active_prompt_id).current;
  React.useEffect(() => {
    if (initialPromptId) fetchCount(initialPromptId).then(setCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-control:${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const next = payload.new as { status: LiveSession["status"]; active_prompt_id: string | null };
          setStatus(next.status);
          setActiveId(next.active_prompt_id);
          if (next.active_prompt_id) fetchCount(next.active_prompt_id).then(setCount);
          else setCount(0);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_responses", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as { prompt_id: string };
          setActiveId((current) => {
            // Releemos el conteo real (en vez de sumar 1 localmente) para que sea
            // idempotente ante entregas duplicadas del evento (p. ej. StrictMode en dev).
            if (current && row.prompt_id === current) fetchCount(current).then(setCount);
            return current;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id]);

  // Respaldo sin Realtime: si el WiFi del aula bloquea WebSockets, el conteo
  // igual se actualiza solo (cada 2.5 s) mientras haya una pregunta activa.
  React.useEffect(() => {
    if (!activeId) return;
    const id = activeId;
    const interval = window.setInterval(() => {
      fetchCount(id).then(setCount);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeId]);

  function copyLink() {
    navigator.clipboard
      .writeText(joinUrl)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch((err) => console.error("[vivo] clipboard", err));
  }

  function activate(promptId: string) {
    setError(null);
    setBusyId(promptId);
    (async () => {
      const res = await setActivePrompt({ sessionId: session.id, promptId });
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus("live");
      setActiveId(promptId);
      setCount(await fetchCount(promptId));
    })();
  }

  function pause() {
    setError(null);
    (async () => {
      const res = await pauseSession({ sessionId: session.id });
      if (!res.ok) setError(res.error);
      else {
        setActiveId(null);
        setCount(0);
      }
    })();
  }

  function end() {
    if (!window.confirm("¿Finalizar la sesión? Nadie va a poder responder más.")) return;
    setError(null);
    setEnding(true);
    (async () => {
      const res = await endSession({ sessionId: session.id });
      setEnding(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus("ended");
      setActiveId(null);
    })();
  }

  const st = STATUS_LABEL[status];

  return (
    <div className="flex flex-col gap-4">
      <Card highlight>
        <div className="mb-1 flex items-start justify-between gap-3">
          <CardHeader className="mb-0">
            <CardTitle eyebrow="Compartí este link una sola vez">Código de sala</CardTitle>
            <CardDescription>Cualquiera que lo abra queda esperando — no hace falta que esté inscripto.</CardDescription>
          </CardHeader>
          <LabBadge size={48} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-2xl border border-border bg-surface-2 px-5 py-3 font-mono text-3xl font-semibold tracking-[0.2em]">
            {session.code}
          </span>
          <Badge tone={st.tone} size="sm" dot={status === "live"} live={status === "live"}>
            {st.label}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copyLink} leftIcon={copied ? <Check /> : <Copy />}>
            {copied ? "Copiado" : "Copiar link"}
          </Button>
          <Button asChild variant="secondary" size="sm" leftIcon={<MonitorPlay />}>
            <a href={projectorUrl} target="_blank" rel="noopener noreferrer">
              Abrir proyector
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" leftIcon={<ExternalLink />}>
            <a href={joinUrl} target="_blank" rel="noopener noreferrer">
              {joinUrl.replace(/^https?:\/\//, "")}
            </a>
          </Button>
        </div>
      </Card>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle eyebrow="Vas activando de a una">Disparadoras</CardTitle>
          <CardDescription>La que esté activa es la única que ven los estudiantes en este momento.</CardDescription>
        </CardHeader>

        <ul className="flex flex-col gap-2" aria-label="Disparadoras de la sesión">
          {prompts.map((p, i) => {
            const isActive = activeId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={status === "ended" || busyId === p.id}
                  onClick={() => activate(p.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive ? "border-accent-2 bg-accent-2/10 glow-2" : "border-border bg-surface-2/60 hover:border-accent/40"
                  }`}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-xs text-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug">{p.question}</span>
                  {isActive ? (
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-accent-2">
                      <Radio className="size-3.5 animate-pulse" aria-hidden /> activa
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">Activar</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <AnimatePresence>
          {activeId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface-2/60 px-4 py-3">
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-accent-2">{count}</span>
                  <span className="text-xs uppercase tracking-widest text-muted">
                    {count === 1 ? "respuesta" : "respuestas"}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={pause} leftIcon={<Pause />}>
                  Pausar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {status !== "ended" && (
        <Button variant="danger" size="sm" className="self-start" onClick={end} loading={ending} leftIcon={<Square />}>
          Finalizar sesión
        </Button>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { Archive, Lock, LockOpen, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DebateStatus } from "./stance";

export interface ModerationBarProps {
  status: DebateStatus;
  /** Abierto por estado pero con fecha vencida */
  expired: boolean;
  hasSynthesis: boolean;
  visibleCount: number;
  pending: "status" | "synthesis" | null;
  onSetStatus: (status: DebateStatus) => Promise<void>;
  onSynthesize: () => Promise<void>;
  className?: string;
}

type Confirm = { kind: "close" | "archive" | "reopen" | "synthesize" } | null;

const COPY: Record<NonNullable<Confirm>["kind"], { title: string; description: string; cta: string }> = {
  close: {
    title: "¿Cerrar el debate?",
    description:
      "Nadie va a poder publicar ni apoyar argumentos. Después del cierre podés generar la síntesis con IA. Se puede reabrir.",
    cta: "Cerrar debate",
  },
  reopen: {
    title: "¿Reabrir el debate?",
    description: "Vuelve a aceptar argumentos y apoyos. Si la fecha de cierre ya venció se elimina.",
    cta: "Reabrir",
  },
  archive: {
    title: "¿Archivar el debate?",
    description: "Queda visible como histórico, sin participación. Se puede reabrir más adelante.",
    cta: "Archivar",
  },
  synthesize: {
    title: "Sintetizar con IA",
    description:
      "La IA va a leer todos los argumentos visibles y producir un mapa del debate: puntos fuertes de cada postura, falacias, preguntas para seguir y conexión con la clase. La síntesis queda visible para todo el curso. Si ya existe una, se reemplaza.",
    cta: "Generar síntesis",
  },
};

/** Acciones del equipo docente sobre el debate: cerrar, reabrir, archivar, sintetizar. */
export function ModerationBar({
  status,
  expired,
  hasSynthesis,
  visibleCount,
  pending,
  onSetStatus,
  onSynthesize,
  className,
}: ModerationBarProps) {
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const busy = pending !== null;
  const effectivelyClosed = status !== "open" || expired;

  const run = async () => {
    if (!confirm) return;
    const kind = confirm.kind;
    setConfirm(null);
    if (kind === "close") await onSetStatus("closed");
    else if (kind === "archive") await onSetStatus("archived");
    else if (kind === "reopen") await onSetStatus("open");
    else await onSynthesize();
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent/5 px-3 py-2.5 sm:px-4",
        className,
      )}
      role="group"
      aria-label="Moderación del debate"
    >
      <span className="mr-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent">
        <ShieldCheck className="size-3.5" aria-hidden />
        Moderación
      </span>

      {status === "open" && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Lock />}
          disabled={busy}
          loading={pending === "status"}
          onClick={() => setConfirm({ kind: "close" })}
        >
          Cerrar debate
        </Button>
      )}
      {status !== "open" && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<LockOpen />}
          disabled={busy}
          loading={pending === "status"}
          onClick={() => setConfirm({ kind: "reopen" })}
        >
          Reabrir
        </Button>
      )}
      {status !== "archived" && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Archive />}
          disabled={busy}
          onClick={() => setConfirm({ kind: "archive" })}
        >
          Archivar
        </Button>
      )}
      {effectivelyClosed && (
        <Button
          size="sm"
          leftIcon={<Sparkles />}
          disabled={busy || visibleCount === 0}
          loading={pending === "synthesis"}
          onClick={() => setConfirm({ kind: "synthesize" })}
          title={visibleCount === 0 ? "No hay argumentos visibles para sintetizar" : undefined}
        >
          {hasSynthesis ? "Regenerar síntesis" : "Sintetizar con IA"}
        </Button>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? COPY[confirm.kind].title : ""}
        description={confirm ? COPY[confirm.kind].description : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirm?.kind === "archive" ? "danger" : "primary"}
              onClick={() => void run()}
              leftIcon={confirm?.kind === "synthesize" ? <Sparkles /> : undefined}
            >
              {confirm ? COPY[confirm.kind].cta : ""}
            </Button>
          </>
        }
      />
    </div>
  );
}

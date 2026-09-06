"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Flame, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatDateLong } from "@/lib/format";
import type { Profile } from "@/lib/types/helpers";

function greetingWord(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function firstName(full: string | null | undefined): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

/**
 * Hero de "Hoy": la pleca carmesí abre la página (como el PageHeader), la fecha
 * va en eyebrow y el nombre en carmesí institucional.
 */
export function Greeting({
  profile,
  courseName,
  streak = 0,
}: {
  profile: Profile;
  courseName: string | null;
  streak?: number;
}) {
  // Hora local de Tucumán para el saludo (el servidor puede estar en otra zona).
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Tucuman", hour: "numeric", hour12: false }).format(
      now,
    ),
  );
  const pending = profile.status === "pendiente";

  return (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 sm:mb-8"
    >
      <div className="pleca min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <time dateTime={now.toISOString().slice(0, 10)} className="eyebrow text-accent">
            {formatDateLong(now)}
          </time>
          {courseName && (
            <Badge tone="muted" size="sm">
              {courseName}
            </Badge>
          )}
          {streak >= 2 && (
            <Badge tone="accent-2" size="sm" className="gap-1">
              <Flame className="size-3" aria-hidden />
              <span className="font-mono tabular-nums">{streak}</span> días seguidos
            </Badge>
          )}
        </div>
        <h1 className="font-display text-[1.65rem] font-extrabold leading-[1.08] tracking-tight sm:text-[2.1rem]">
          {greetingWord(hour)}, <span className="text-accent">{firstName(profile.full_name) || "estudiante"}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-[15px]">
          Esto es lo que tenés para hoy: tu próxima clase, lo pendiente y lo que dejó la última clase.
        </p>
      </div>

      {pending && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          role="status"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-display font-bold">Cuenta pendiente de validación</span>
              <Badge tone="warning" size="sm" dot live>
                pendiente
              </Badge>
            </div>
            <p className="leading-relaxed text-muted">
              Tu email todavía no figura en el padrón de la comisión. Podés usar el campus con normalidad; el equipo
              docente va a validar tu cuenta y, si corresponde, inscribirte en la comisión correcta.
            </p>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

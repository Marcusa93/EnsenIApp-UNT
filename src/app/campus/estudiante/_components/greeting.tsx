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
  const hour = Number(
    new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Tucuman", hour: "numeric", hour12: false }).format(
      new Date(),
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
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-accent-2" aria-hidden />
        <span className="eyebrow">{formatDateLong(new Date())}</span>
        {courseName && (
          <Badge tone="accent" size="sm">
            {courseName}
          </Badge>
        )}
        {streak >= 2 && (
          <Badge tone="accent-3" size="sm" className="gap-1">
            <Flame className="size-3" aria-hidden />
            {streak} días seguidos
          </Badge>
        )}
      </div>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {greetingWord(hour)}, <span className="text-gradient">{firstName(profile.full_name) || "estudiante"}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
        Esto es lo que tenés para hoy: tu próxima clase, lo pendiente y lo que dejó la última clase.
      </p>

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
              <span className="font-medium">Cuenta pendiente de validación</span>
              <Badge tone="warning" size="sm" dot live>
                pendiente
              </Badge>
            </div>
            <p className="text-muted">
              Tu email todavía no figura en el padrón de la comisión. Podés usar el campus con normalidad; el equipo
              docente va a validar tu cuenta y, si corresponde, inscribirte en la comisión correcta.
            </p>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

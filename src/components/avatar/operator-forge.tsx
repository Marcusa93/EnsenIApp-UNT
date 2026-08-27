"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Loader2, Shuffle } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { OperatorAvatar } from "./operator-avatar";
import { Turntable } from "./turntable";
import { CHASSIS, GLOWS, TONES } from "./palette";
import { createOperator, updateOperator } from "@/app/campus/estudiante/juegos/avatar-actions";

/**
 * Forja del operador: crear o retocar el aspecto base. El retrato se actualiza en
 * vivo mientras se elige — es la mitad de la gracia.
 */

const ALIAS_SUGERIDOS = [
  "Alberdi Jr.", "Fiscal Cero", "Habeas", "Nullius", "Iuris", "Vélez", "Precedente",
  "Amparo", "Cassé", "Dolo Eventual", "Erga Omnes", "Sana Crítica",
];

export interface OperatorForgeProps {
  mode: "crear" | "editar";
  initial?: { callsign: string; chassis: string; tone: string; glow: string; equipped: Record<string, string> };
  onDone?: () => void;
}

export function OperatorForge({ mode, initial, onDone }: OperatorForgeProps) {
  const router = useRouter();
  const [callsign, setCallsign] = React.useState(initial?.callsign ?? "");
  const [chassis, setChassis] = React.useState(initial?.chassis ?? "redondo");
  const [tone, setTone] = React.useState(initial?.tone ?? "acero");
  const [glow, setGlow] = React.useState(initial?.glow ?? "violeta");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Al crear, se muestra con el equipo de arranque para que no se vea vacío.
  const equipped = initial?.equipped ?? {
    visor: "visor-basico",
    toga: "toga-cursante",
    instrumento: "inst-codice",
    fondo: "fondo-aula",
  };

  function randomize() {
    setChassis(CHASSIS[Math.floor(Math.random() * CHASSIS.length)].id);
    setTone(TONES[Math.floor(Math.random() * TONES.length)].id);
    setGlow(GLOWS[Math.floor(Math.random() * GLOWS.length)].id);
    if (!callsign) setCallsign(ALIAS_SUGERIDOS[Math.floor(Math.random() * ALIAS_SUGERIDOS.length)]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const action = mode === "crear" ? createOperator : updateOperator;
    const res = await action({ callsign, chassis, tone, glow });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    router.refresh();
    onDone?.();
    setSaving(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
      {/* Retrato en vivo */}
      <div className="flex min-w-0 flex-col items-center gap-3 lg:col-span-5">
        <motion.div
          key={`${chassis}-${tone}-${glow}`}
          initial={{ scale: 0.96, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[280px]"
        >
          <Turntable config={{ chassis, tone, glow, equipped }} size={280} title={callsign || "Tu operador"} />
        </motion.div>
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted">{callsign || "sin alias"}</p>
      </div>

      {/* Controles */}
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <Card padding="sm">
          <Label htmlFor="callsign">Alias de operador</Label>
          <p className="mb-2 mt-0.5 text-xs text-muted">
            Es como te ve la comisión en la tabla de posiciones. No uses tu nombre real si no querés.
          </p>
          <div className="flex gap-2">
            <Input
              id="callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="Elegí un alias"
              maxLength={20}
            />
            <Button variant="secondary" size="icon" onClick={randomize} aria-label="Sortear aspecto y alias">
              <Shuffle className="size-4" />
            </Button>
          </div>
        </Card>

        <Card padding="sm">
          <p className="text-sm font-medium">Chasis</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CHASSIS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChassis(c.id)}
                aria-pressed={chassis === c.id}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2 transition",
                  chassis === c.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-2/50 hover:border-accent/40",
                )}
              >
                <OperatorAvatar
                  config={{ chassis: c.id, tone, glow, equipped: { visor: equipped.visor } }}
                  size={56}
                  bust
                />
                <span className="text-[11px] font-medium">{c.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">{CHASSIS.find((c) => c.id === chassis)?.hint}</p>
        </Card>

        <Card padding="sm">
          <p className="text-sm font-medium">Material del chasis</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                aria-pressed={tone === t.id}
                aria-label={t.name}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
                  tone === t.id ? "border-accent bg-accent/10" : "border-border bg-surface-2/50 hover:border-accent/40",
                )}
              >
                <span className="size-4 rounded-full border border-white/15" style={{ background: t.shell }} />
                {t.name}
              </button>
            ))}
          </div>
        </Card>

        <Card padding="sm">
          <p className="text-sm font-medium">Luz del operador</p>
          <p className="mb-2 mt-0.5 text-xs text-muted">Define el color del visor, los ribetes y el aura.</p>
          <div className="flex flex-wrap gap-2">
            {GLOWS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGlow(g.id)}
                aria-pressed={glow === g.id}
                aria-label={g.name}
                className={cn(
                  "size-10 rounded-full border-2 transition",
                  glow === g.id ? "scale-110 border-foreground" : "border-transparent hover:scale-105",
                )}
                style={{ background: g.hex, boxShadow: glow === g.id ? `0 0 16px ${g.hex}80` : undefined }}
              >
                {glow === g.id && <Check className="mx-auto size-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </Card>

        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          onClick={save}
          disabled={saving || callsign.trim().length < 3}
          leftIcon={saving ? <Loader2 className="animate-spin" /> : undefined}
          className="w-full sm:w-auto"
        >
          {mode === "crear" ? "Crear mi operador" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

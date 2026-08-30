import Link from "next/link";
import { Gamepad2, Target } from "lucide-react";
import { Button, Card, Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Dominio por clase: en qué anda flojo y qué le conviene repasar.
 *
 * El dato ya estaba —cada partida guarda la clase y cuántas acertó—, pero sólo
 * se mostraba sumado como XP, que dice "cuánto jugaste", no "qué sabés". Acá se
 * abre por clase, ordenado por lo más flojo primero, con el atajo para repasar
 * el material o volver a jugar esa clase.
 *
 * Se piden al menos 4 respuestas por clase para mostrarla: con dos preguntas
 * sueltas el porcentaje es ruido y mandaría a estudiar cualquier cosa.
 */

export interface DominioClase {
  classId: string;
  topic: string;
  correct: number;
  answered: number;
}

/** Debajo de esto conviene repasar antes que seguir jugando. */
const FLOJO = 0.6;
const SOLIDO = 0.8;

export function DominioClases({ clases }: { clases: DominioClase[] }) {
  if (clases.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">
          Jugá algunas partidas y acá vas a ver en qué clases estás firme y cuáles conviene repasar.
        </p>
        <div className="mt-3">
          <Button asChild size="sm" variant="secondary" leftIcon={<Gamepad2 />}>
            <Link href="/campus/estudiante/juegos">Ir a Juegos</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const flojas = clases.filter((c) => c.correct / c.answered < FLOJO);

  return (
    <div className="flex flex-col gap-3">
      {flojas.length > 0 && (
        <p className="text-sm text-muted">
          {flojas.length === 1
            ? "Hay una clase que conviene repasar antes de seguir."
            : `Hay ${flojas.length} clases que conviene repasar antes de seguir.`}{" "}
          Empezá por la de arriba.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {clases.map((c) => {
          const ratio = c.correct / c.answered;
          const pct = Math.round(ratio * 100);
          const tono = ratio < FLOJO ? "accent-3" : ratio < SOLIDO ? "accent" : "accent-2";
          return (
            <li key={c.classId} className="rounded-2xl border border-border bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.topic}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                    {c.correct} de {c.answered} aciertos
                    {ratio < FLOJO ? " · para repasar" : ratio >= SOLIDO ? " · firme" : " · casi"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-sm tabular-nums",
                    ratio < FLOJO ? "text-accent-3" : ratio < SOLIDO ? "text-accent" : "text-accent-2",
                  )}
                >
                  {pct}%
                </span>
              </div>

              <div className="mt-2.5">
                <Progress value={pct} size="sm" tone={tono} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/campus/estudiante/clases/${c.classId}`}>Repasar la clase</Link>
                </Button>
                <Button asChild size="sm" variant="ghost" leftIcon={<Target />}>
                  <Link href={`/campus/estudiante/juegos?clase=${c.classId}`}>Practicar esta clase</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

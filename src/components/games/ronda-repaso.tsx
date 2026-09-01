import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * El repaso final de una ronda: qué acertaste, qué era lo correcto y de dónde
 * sale (explicación + cita textual con el minuto de la clase).
 *
 * Es EL momento pedagógico del juego — enterarse qué se falló y por qué vale
 * más que el puntaje — y estaba sólo en la partida individual: los retos contra
 * compañeros y los Botudiantes tiraban el aprendizaje a la basura mostrando
 * apenas "4 de 5". Extraído acá para que los tres modos lo compartan.
 */

export interface RepasoChallenge {
  id: string;
  prompt: string;
  options: string[];
}

export interface RepasoResult {
  id: string;
  chosen: number;
  correct: boolean;
  correctIndex: number;
  explanation: string | null;
  sourceQuote: string | null;
  sourceSeconds: number | null;
  classId: string | null;
}

function mmss(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function RondaRepaso({
  challenges,
  results,
  className,
}: {
  challenges: RepasoChallenge[];
  results: RepasoResult[];
  className?: string;
}) {
  if (results.length === 0) return null;
  const byId = new Map(challenges.map((c) => [c.id, c]));

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {results.map((r) => {
        const ch = byId.get(r.id);
        if (!ch) return null;
        return (
          <li
            key={r.id}
            className={cn(
              "rounded-2xl border p-3.5",
              r.correct ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  r.correct ? "bg-success/20 text-success" : "bg-danger/20 text-danger",
                )}
                aria-hidden
              >
                {r.correct ? <Check className="size-3" /> : <X className="size-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{ch.prompt}</p>
                {!r.correct && (
                  <p className="mt-1 text-[13px] text-muted">
                    Era: <span className="text-foreground">{ch.options[r.correctIndex]}</span>
                  </p>
                )}
                {r.explanation && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{r.explanation}</p>}
                {r.sourceQuote && (
                  <p className="mt-2 border-l-2 border-border pl-2.5 text-[12px] italic leading-relaxed text-muted">
                    “{r.sourceQuote}”
                    {r.sourceSeconds != null && r.classId && (
                      <Link
                        href={`/campus/estudiante/clases/${r.classId}`}
                        className="ml-1.5 not-italic text-accent hover:underline"
                      >
                        [{mmss(r.sourceSeconds)}]
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

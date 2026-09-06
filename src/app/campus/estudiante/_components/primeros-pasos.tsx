import Link from "next/link";
import { BookOpen, Check, ChevronRight, Feather, Gamepad2, Sparkles } from "lucide-react";
import { Card, CardTitle, Progress } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Primeros pasos: lo que ve el estudiante recién llegado, en vez de un tablero
 * lleno de tarjetas vacías.
 *
 * Se arma con lo que ya hizo, no con una lista fija: cada paso se marca solo
 * cuando lo cumplió. La tarjeta desaparece cuando terminó todo — no queda
 * ocupando lugar para siempre en el tablero de alguien que ya sabe moverse.
 */

export interface PasoEstado {
  /** Abrió al menos una clase del cronograma. */
  vioClase: boolean;
  /** Le preguntó algo a Alberdi. */
  usoAlberdi: boolean;
  /** Creó su operador (hace falta para Juegos y el Aula Magna). */
  tieneOperador: boolean;
  /** Jugó al menos una partida. */
  jugo: boolean;
}

interface Paso {
  hecho: boolean;
  titulo: string;
  detalle: string;
  href: string;
  icono: React.ReactNode;
  /** Violeta para lo que es IA (Alberdi); carmesí para el resto. */
  ia?: boolean;
}

export function PrimerosPasos({ estado, nextClassId }: { estado: PasoEstado; nextClassId: string | null }) {
  const pasos: Paso[] = [
    {
      hecho: estado.vioClase,
      titulo: "Mirá una clase",
      detalle: "El resumen, las placas y la transcripción de lo que se dijo.",
      href: nextClassId ? `/campus/estudiante/clases/${nextClassId}` : "/campus/estudiante/clases",
      icono: <BookOpen className="size-4" aria-hidden />,
    },
    {
      hecho: estado.usoAlberdi,
      titulo: "Preguntale a Alberdi",
      detalle: "Responde con el material de la cátedra, no con cualquier cosa de internet.",
      href: "/campus/estudiante/alberdi",
      icono: <Feather className="size-4" aria-hidden />,
      ia: true,
    },
    {
      hecho: estado.tieneOperador,
      titulo: "Armá tu operador",
      detalle: "Tu personaje del campus. Con él entrás a los juegos y al Aula Magna.",
      href: "/campus/estudiante/juegos",
      icono: <Sparkles className="size-4" aria-hidden />,
    },
    {
      hecho: estado.jugo,
      titulo: "Jugá tu primera partida",
      detalle: "Cinco preguntas de lo que se dijo en clase. Dos minutos.",
      href: "/campus/estudiante/juegos",
      icono: <Gamepad2 className="size-4" aria-hidden />,
    },
  ];

  const hechos = pasos.filter((p) => p.hecho).length;
  if (hechos === pasos.length) return null;

  return (
    <Card className="border-t-[3px] border-t-accent">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle eyebrow="Para empezar" as="h2">
            Tus primeros pasos
          </CardTitle>
          <p className="mt-1 text-sm text-muted">Cuatro cosas para conocer el campus. Se van marcando solas.</p>
        </div>
        <p className="shrink-0 text-right text-sm text-muted">
          <span className="display-num text-2xl text-accent-2">{hechos}</span>
          <span className="font-mono tabular-nums"> / {pasos.length}</span>
          <span className="sr-only"> pasos completados</span>
        </p>
      </div>

      <Progress className="mt-3" value={(hechos / pasos.length) * 100} size="sm" tone="accent-2" />

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {pasos.map((p) => (
          <li key={p.titulo} className="min-w-0">
            {p.hecho ? (
              <div className="flex min-h-12 items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-muted line-through">
                  {p.titulo}
                </p>
              </div>
            ) : (
              <Link
                href={p.href}
                className={cn(
                  "group flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 transition-colors",
                  "hover:border-accent/45 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    p.ia
                      ? "border-accent-3/30 bg-accent-3/10 text-accent-3"
                      : "border-accent/30 bg-accent/10 text-accent",
                  )}
                >
                  {p.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-semibold">{p.titulo}</span>
                  <span className="block text-xs leading-snug text-muted">{p.detalle}</span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  aria-hidden
                />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

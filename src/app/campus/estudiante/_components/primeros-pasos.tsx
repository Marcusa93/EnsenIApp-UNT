import Link from "next/link";
import { BookOpen, Check, Feather, Gamepad2, Sparkles } from "lucide-react";
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
    <Card highlight>
      <CardTitle eyebrow="Para empezar" as="h2">
        Tus primeros pasos
      </CardTitle>
      <p className="mt-1 text-sm text-muted">
        Cuatro cosas para conocer el campus. Se van marcando solas.
      </p>

      <div className="mt-3">
        <Progress value={(hechos / pasos.length) * 100} size="sm" tone="accent-2" />
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
          {hechos} de {pasos.length}
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {pasos.map((p) => (
          <li key={p.titulo}>
            {p.hecho ? (
              <div className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-muted line-through">{p.titulo}</p>
              </div>
            ) : (
              <Link
                href={p.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 transition",
                  "hover:border-accent/45 hover:bg-surface-2",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                  {p.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{p.titulo}</span>
                  <span className="block text-xs text-muted">{p.detalle}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

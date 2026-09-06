import Link from "next/link";
import { Target } from "lucide-react";
import { Button, Card } from "@/components/ui";

/**
 * El empujón de estudio en Hoy: tu clase más floja, con el atajo para
 * repasarla o practicarla.
 *
 * El diagnóstico completo vive en Mi progreso, pero en el celular esa pestaña
 * queda detrás de "Más" — el rincón menos visitado del campus. La guía de
 * estudio tiene que aparecer donde el estudiante ya está: acá.
 *
 * Es un dato (porcentaje de aciertos), no IA: va en verde petróleo.
 */
export function RepasoSugerido({
  classId,
  topic,
  correct,
  answered,
}: {
  classId: string;
  topic: string;
  correct: number;
  answered: number;
}) {
  const pct = Math.round((correct / answered) * 100);
  return (
    <Card padding="sm" className="border-accent-2/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-2/30 bg-accent-2/10 text-accent-2"
            aria-hidden
          >
            <Target className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-[10px] text-accent-2">Para repasar</p>
            <p className="truncate font-display text-sm font-bold">{topic}</p>
            <p className="text-xs text-muted">
              <span className="font-mono tabular-nums">
                {correct} de {answered}
              </span>{" "}
              respuestas correctas
            </p>
          </div>
          <p className="shrink-0 text-right leading-none">
            <span className="display-num block text-2xl text-accent-2">
              {pct}
              <span className="text-base">%</span>
            </span>
            <span className="eyebrow text-[9px]">aciertos</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button asChild variant="outline">
            <Link href={`/campus/estudiante/clases/${classId}`}>Repasar</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/campus/estudiante/juegos?clase=${classId}`}>Practicar</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

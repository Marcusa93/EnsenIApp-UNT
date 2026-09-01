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
    <Card padding="sm" className="border-accent-3/30">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent-3/30 bg-accent-3/10 text-accent-3"
          aria-hidden
        >
          <Target className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-[10px] text-accent-3">Para repasar</p>
          <p className="truncate text-sm font-medium">{topic}</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {pct}% de aciertos · {correct} de {answered}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/campus/estudiante/clases/${classId}`}>Repasar</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/campus/estudiante/juegos?clase=${classId}`}>Practicar</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

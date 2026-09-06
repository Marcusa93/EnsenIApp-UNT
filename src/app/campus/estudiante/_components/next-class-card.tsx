import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle } from "@/components/ui";
import { formatDate, formatDateLong, formatRelative } from "@/lib/format";

export interface NextClassData {
  id: string;
  topic: string;
  summary: string | null;
  class_date: string;
  teacher: { full_name: string; position: string } | null;
  isToday: boolean;
}

/** La tarjeta protagonista de "Hoy": expediente con pleca, esquinas y trama de fondo. */
export function NextClassCard({ data }: { data: NextClassData | null }) {
  if (!data) {
    return (
      <Card className="relative h-full overflow-hidden">
        <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-70" aria-hidden />
        <div className="relative flex h-full flex-col">
          <CardTitle eyebrow="Próxima clase" as="h2">
            No hay clases programadas por delante
          </CardTitle>
          <CardDescription className="mt-2">
            Cuando el equipo docente cargue la próxima fecha, vas a verla acá con el tema y el docente a cargo.
          </CardDescription>
          <div className="mt-auto pt-5">
            <Button asChild variant="outline" rightIcon={<ArrowRight />}>
              <Link href="/campus/estudiante/clases">Ver cronograma completo</Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card highlight className="relative h-full overflow-hidden">
      <div className="trama campus-grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex h-full flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="eyebrow text-accent">Próxima clase</span>
          {data.isToday ? (
            <Badge tone="accent-2" dot live size="sm">
              Hoy
            </Badge>
          ) : (
            <Badge tone="muted" size="sm">
              {formatRelative(`${data.class_date}T12:00:00-03:00`)}
            </Badge>
          )}
        </div>
        <h2 className="font-display text-xl font-bold leading-snug tracking-tight sm:text-2xl">{data.topic}</h2>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
          <div className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0 text-accent-2" aria-hidden />
            <dt className="sr-only">Fecha</dt>
            <dd className="min-w-0">
              <span className="capitalize">{formatDateLong(data.class_date)}</span>
              <span className="ml-1.5 font-mono text-xs tabular-nums">({formatDate(data.class_date)})</span>
            </dd>
          </div>
          {data.teacher && (
            <div className="flex min-w-0 items-center gap-1.5">
              <UserRound className="size-4 shrink-0 text-accent-2" aria-hidden />
              <dt className="sr-only">Docente</dt>
              <dd className="min-w-0">
                {data.teacher.full_name}
                <span className="ml-1.5 text-xs text-muted/80">· {data.teacher.position}</span>
              </dd>
            </div>
          )}
        </dl>
        {data.summary && <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted">{data.summary}</p>}
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Button asChild rightIcon={<ArrowRight />}>
            <Link href={`/campus/estudiante/clases/${data.id}`}>Abrir la clase</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/campus/estudiante/clases">Cronograma</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

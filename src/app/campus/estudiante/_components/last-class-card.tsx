import Link from "next/link";
import { ArrowRight, BookOpenText, FileText, Layers, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/format";

export interface RecordingAccess {
  id: string;
  title: string | null;
  has_summary: boolean;
  has_cards: boolean;
  has_simplified: boolean;
  has_transcript: boolean;
  duration_seconds: number | null;
}

export interface LastClassData {
  id: string;
  topic: string;
  summary: string | null;
  class_date: string;
  teacher: { full_name: string; position: string } | null;
  recordings: RecordingAccess[];
}

export function LastClassCard({ data }: { data: LastClassData }) {
  const rec = data.recordings[0] ?? null;
  const classHref = `/campus/estudiante/clases/${data.id}`;

  return (
    <Card className="relative h-full overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="eyebrow">Última clase</span>
        <Badge tone="muted" size="sm">
          {formatDate(data.class_date)}
        </Badge>
        {rec ? (
          <Badge tone="success" size="sm" dot>
            Grabación publicada
          </Badge>
        ) : (
          <Badge tone="muted" size="sm">
            Sin grabación todavía
          </Badge>
        )}
      </div>
      <CardTitle as="h2" className="text-lg sm:text-xl">
        {data.topic}
      </CardTitle>
      {data.teacher && <CardDescription className="mt-1">{data.teacher.full_name}</CardDescription>}
      {data.summary && !rec && <p className="mt-3 line-clamp-3 text-sm text-muted">{data.summary}</p>}

      {rec ? (
        <>
          <p className="mt-3 text-sm text-muted">
            {rec.title ?? "Grabación de la clase"}
            {rec.duration_seconds ? (
              <span className="ml-2 font-mono text-xs">· {formatDuration(rec.duration_seconds)}</span>
            ) : null}
            {data.recordings.length > 1 && (
              <span className="ml-2 font-mono text-xs">· {data.recordings.length} grabaciones</span>
            )}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickLink
              href={`${classHref}#resumen`}
              icon={<FileText />}
              label="Resumen"
              enabled={rec.has_summary}
              hint="Puntos clave de la clase"
            />
            <QuickLink
              href={`/campus/estudiante/placas/${rec.id}`}
              icon={<Layers />}
              label="Placas"
              enabled={rec.has_cards}
              hint="Flashcards y quiz"
              tone="accent-2"
            />
            <QuickLink
              href={`${classHref}#simple`}
              icon={<Sparkles />}
              label="Versión simple"
              enabled={rec.has_simplified}
              hint="Lenguaje claro"
              tone="accent-3"
            />
            <QuickLink
              href={`${classHref}#transcripcion`}
              icon={<BookOpenText />}
              label="Transcripción"
              enabled={rec.has_transcript}
              hint="Texto completo"
            />
          </ul>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Cuando el equipo docente publique la grabación vas a tener acá el resumen, las placas interactivas y la
          transcripción.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary" rightIcon={<ArrowRight />}>
          <Link href={classHref}>Ir a la clase</Link>
        </Button>
        <Button asChild size="sm" variant="ghost" leftIcon={<MessageCircleQuestion />}>
          <Link href={`/campus/estudiante/alberdi?classId=${data.id}`}>Tengo una duda</Link>
        </Button>
      </div>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
  hint,
  enabled,
  tone = "accent",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  enabled: boolean;
  tone?: "accent" | "accent-2" | "accent-3";
}) {
  const toneClass = {
    accent: "text-accent border-accent/25 bg-accent/10 group-hover:bg-accent/20",
    "accent-2": "text-accent-2 border-accent-2/25 bg-accent-2/10 group-hover:bg-accent-2/20",
    "accent-3": "text-accent-3 border-accent-3/25 bg-accent-3/10 group-hover:bg-accent-3/20",
  }[tone];

  if (!enabled) {
    return (
      <li className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-muted/70">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 [&>svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium">{label}</span>
          <span className="block text-[11px]">No disponible</span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors [&>svg]:size-4 ${toneClass}`}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium">{label}</span>
          <span className="block truncate text-[11px] text-muted">{hint}</span>
        </span>
      </Link>
    </li>
  );
}

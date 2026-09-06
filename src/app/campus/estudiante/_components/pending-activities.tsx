import Link from "next/link";
import { ArrowRight, ClipboardCheck, ClipboardList, Clock } from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Enums } from "@/lib/types/helpers";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE_LABEL } from "./student-data";

export interface PendingActivity {
  id: string;
  title: string;
  type: Enums<"activity_type">;
  due_at: string | null;
  published_at: string | null;
  in_progress: boolean;
}

const MAX_VISIBLE = 4;

type DueTone = "danger" | "warning" | "muted";

function dueTone(dueAt: string | null): DueTone {
  if (!dueAt) return "muted";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return "danger";
  if (diff < 48 * 3600 * 1000) return "warning";
  return "muted";
}

const dueClass: Record<DueTone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted",
};

export function PendingActivities({ items }: { items: PendingActivity[] }) {
  const visible = items.slice(0, MAX_VISIBLE);
  const rest = items.length - visible.length;

  return (
    <Card className="h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">Actividades pendientes</span>
          <h3 className="mt-1 flex flex-wrap items-baseline gap-x-2 font-display font-bold leading-none tracking-tight">
            {items.length === 0 ? (
              <span className="text-base">Estás al día</span>
            ) : (
              <>
                <span className="display-num text-3xl text-accent sm:text-4xl">{items.length}</span>
                <span className="text-sm font-semibold text-muted">por entregar</span>
              </>
            )}
          </h3>
        </div>
        <ClipboardList className="size-4 shrink-0 text-accent" aria-hidden />
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={ClipboardCheck}
          tone="accent-2"
          title="No tenés actividades pendientes"
          description="Cuando el equipo docente publique una nueva actividad, la vas a ver acá con su fecha límite."
          action={
            <Button asChild variant="ghost">
              <Link href="/campus/estudiante/actividades">Ver mis entregas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visible.map((a) => {
              const tone = dueTone(a.due_at);
              return (
                <li key={a.id}>
                  <Link
                    href={`/campus/estudiante/actividades/${a.id}`}
                    className="group flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3.5 py-3 transition-colors hover:border-accent/50 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="accent" size="sm">
                          {ACTIVITY_TYPE_LABEL[a.type]}
                        </Badge>
                        {a.in_progress && (
                          <Badge tone="accent-2" size="sm">
                            En curso
                          </Badge>
                        )}
                      </div>
                      <p className="truncate font-display text-sm font-semibold">{a.title}</p>
                      <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-1 text-xs", dueClass[tone])}>
                        <Clock className="size-3 shrink-0" aria-hidden />
                        {a.due_at ? (
                          <>
                            <span>
                              {tone === "danger" ? "Venció" : "Vence"} {formatRelative(a.due_at)}
                            </span>
                            <time dateTime={a.due_at} className="font-mono tabular-nums">
                              · {formatDateTime(a.due_at)}
                            </time>
                          </>
                        ) : (
                          <span>Sin fecha límite</span>
                        )}
                      </p>
                    </div>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <Button asChild variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/campus/estudiante/actividades">
                {rest > 0 ? `Ver las ${rest} restantes` : "Todas mis actividades"}
              </Link>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

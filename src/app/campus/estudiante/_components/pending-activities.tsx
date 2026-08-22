import Link from "next/link";
import { ArrowRight, ClipboardCheck, ClipboardList, Clock } from "lucide-react";
import { Badge, Button, Card, CardTitle, EmptyState } from "@/components/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { Enums } from "@/lib/types/helpers";
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

function dueTone(dueAt: string | null): "danger" | "warning" | "muted" {
  if (!dueAt) return "muted";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return "danger";
  if (diff < 48 * 3600 * 1000) return "warning";
  return "muted";
}

export function PendingActivities({ items }: { items: PendingActivity[] }) {
  const visible = items.slice(0, MAX_VISIBLE);
  const rest = items.length - visible.length;

  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <CardTitle eyebrow="Actividades pendientes">
          {items.length === 0 ? "Estás al día" : `${items.length} por entregar`}
        </CardTitle>
        <ClipboardList className="size-4 text-accent" aria-hidden />
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={ClipboardCheck}
          tone="accent-2"
          title="No tenés actividades pendientes"
          description="Cuando el equipo docente publique una nueva actividad, la vas a ver acá con su fecha límite."
          action={
            <Button asChild variant="ghost" size="sm">
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
                    className="group flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3.5 py-3 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className={`mt-0.5 flex items-center gap-1 text-xs ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted"}`}>
                        <Clock className="size-3" aria-hidden />
                        {a.due_at
                          ? tone === "danger"
                            ? `Venció ${formatRelative(a.due_at)} (${formatDateTime(a.due_at)})`
                            : `Vence ${formatRelative(a.due_at)} · ${formatDateTime(a.due_at)}`
                          : "Sin fecha límite"}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
              <Link href="/campus/estudiante/actividades">{rest > 0 ? `Ver las ${rest} restantes` : "Todas mis actividades"}</Link>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

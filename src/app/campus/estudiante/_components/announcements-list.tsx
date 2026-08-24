import Link from "next/link";
import { Bell, Megaphone } from "lucide-react";
import { Badge, Card, CardTitle, EmptyState } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { isRecent } from "./student-data";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  class_id: string | null;
}

export function AnnouncementsList({ items }: { items: AnnouncementItem[] }) {
  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <CardTitle eyebrow="Avisos del equipo docente">Novedades</CardTitle>
        <Bell className="size-4 text-accent-3" aria-hidden />
      </div>
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={Megaphone}
          tone="muted"
          title="Sin avisos por ahora"
          description="Acá van a aparecer los mensajes del equipo docente: cambios de aula, material extra, fechas."
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => {
            const isNew = isRecent(a.created_at);
            return (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold leading-snug">{a.title}</h3>
                  {isNew && (
                    <Badge tone="accent-3" size="sm" dot live>
                      Nuevo
                    </Badge>
                  )}
                  <time dateTime={a.created_at} className="ml-auto font-mono text-[11px] text-muted">
                    {formatRelative(a.created_at)}
                  </time>
                </div>
                <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-muted">{a.body}</p>
                {a.class_id && (
                  <Link
                    href={`/campus/estudiante/clases/${a.class_id}`}
                    className="mt-1.5 inline-block text-xs font-medium text-accent-2 underline-offset-4 hover:underline"
                  >
                    Ver la clase relacionada
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

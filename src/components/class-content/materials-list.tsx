import { ExternalLink, FileText, FileWarning, Link2, Paperclip, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Enums } from "@/lib/types/helpers";

export interface MaterialListItem {
  id: string;
  title: string;
  kind: Enums<"material_kind">;
  href: string | null;
  is_file: boolean;
}

const KIND: Record<Enums<"material_kind">, { label: string; icon: LucideIcon }> = {
  pdf: { label: "PDF", icon: FileText },
  doc: { label: "Documento", icon: FileText },
  video: { label: "Video", icon: Video },
  link: { label: "Enlace", icon: Link2 },
  otro: { label: "Archivo", icon: Paperclip },
};

/** Lista de materiales de la clase (server-safe). Las URLs firmadas ya vienen resueltas. */
export function MaterialsList({ materials }: { materials: MaterialListItem[] }) {
  if (materials.length === 0) {
    return (
      <EmptyState
        compact
        tone="muted"
        icon={Paperclip}
        title="Todavía no hay materiales"
        description="Cuando el equipo docente suba bibliografía o enlaces, los vas a ver acá."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Materiales de la clase">
      {materials.map((m) => {
        const meta = KIND[m.kind];
        const Icon = m.href ? meta.icon : FileWarning;
        const inner = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent-2 [&>svg]:size-4">
              <Icon aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{m.title}</span>
              <span className="mt-0.5 flex items-center gap-2">
                <Badge size="sm" tone={m.href ? "muted" : "warning"}>
                  {m.href ? meta.label : "No disponible"}
                </Badge>
                {m.is_file && m.href && (
                  <span className="text-[11px] text-muted">Enlace válido por 1 hora</span>
                )}
              </span>
            </span>
            {m.href && <ExternalLink className="size-4 shrink-0 text-muted" aria-hidden />}
          </>
        );
        return (
          <li key={m.id}>
            {m.href ? (
              <a
                href={m.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent/60 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {inner}
              </a>
            ) : (
              <div
                className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-3 opacity-80"
                title="No pudimos generar el enlace de descarga. Reintentá más tarde."
              >
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

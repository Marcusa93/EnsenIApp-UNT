import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Database, KeyRound, XCircle } from "lucide-react";
import { Badge, Card, CardDescription, CardHeader, CardTitle, EmptyState, type BadgeTone } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Enums } from "@/lib/types/helpers";
import { cn } from "@/lib/utils";
import type { SystemData } from "../_lib/data";

const STATUS_LABEL: Record<Enums<"recording_status">, string> = {
  uploaded: "Subidas",
  transcribing: "Transcribiendo",
  processing: "Procesando",
  generating: "Generando",
  ready: "Listas",
  error: "Con error",
};

const STATUS_TONE: Record<Enums<"recording_status">, BadgeTone> = {
  uploaded: "muted",
  transcribing: "accent-2",
  processing: "accent-2",
  generating: "accent",
  ready: "success",
  error: "danger",
};

/** Sólo lectura: estado del entorno, conteos y errores recientes del pipeline. Server Component. */
export function SystemTab({ system }: { system: SystemData }) {
  const missingRequired = system.env.filter((v) => v.required && !v.present);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Variables de entorno */}
      <Card padding="sm" className="lg:col-span-1">
        <CardHeader>
          <CardTitle as="h3" eyebrow="Entorno">
            Variables de entorno
          </CardTitle>
          <CardDescription>
            Sólo se indica si están definidas; los valores nunca se muestran.
            {missingRequired.length > 0 && (
              <span className="mt-1 block text-danger">
                Faltan {missingRequired.length} variable{missingRequired.length === 1 ? "" : "s"} obligatoria
                {missingRequired.length === 1 ? "" : "s"}.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <ul className="mt-3 divide-y divide-border">
          {system.env.map((v) => (
            <li key={v.name} className="flex items-center gap-3 py-2">
              {v.present ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              ) : v.required ? (
                <XCircle className="size-4 shrink-0 text-danger" aria-hidden />
              ) : (
                <CircleDashed className="size-4 shrink-0 text-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{v.name}</p>
                <p className="truncate text-[11px] text-muted">{v.hint}</p>
              </div>
              <Badge tone={v.present ? "success" : v.required ? "danger" : "muted"} size="sm">
                {v.present ? "Definida" : v.required ? "Falta" : "Opcional"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* Conteos */}
      <Card padding="sm">
        <CardHeader>
          <CardTitle as="h3" eyebrow="Base de datos">
            Conteo de tablas
          </CardTitle>
          <CardDescription>Filas por tabla (lectura con service role, sin filtros de RLS).</CardDescription>
        </CardHeader>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {system.counts.map((c) => (
            <li
              key={c.table}
              className={cn(
                "rounded-xl border border-border bg-surface-2/60 px-3 py-2",
                c.error && "border-danger/30 bg-danger/10",
              )}
              title={c.error ?? undefined}
            >
              <p className="eyebrow text-[10px]">{c.label}</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
                {c.count === null ? <span className="text-danger">—</span> : c.count.toLocaleString("es-AR")}
              </p>
              <p className="truncate font-mono text-[10px] text-muted">{c.table}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Pipeline */}
      <Card padding="sm" className="lg:col-span-2">
        <CardHeader>
          <CardTitle as="h3" eyebrow="Pipeline IA">
            Grabaciones por estado
          </CardTitle>
          <CardDescription>
            El pipeline es por pasos y reintentable: una grabación con error se retoma desde la clase (panel docente) volviendo a
            procesarla.
          </CardDescription>
        </CardHeader>
        <div className="mt-3 flex flex-wrap gap-2">
          {system.pipeline.map((p) => (
            <Badge key={p.status} tone={STATUS_TONE[p.status]} size="md" dot live={p.status === "generating" || p.status === "transcribing"}>
              {STATUS_LABEL[p.status]} · <span className="font-semibold tabular-nums">{p.count}</span>
            </Badge>
          ))}
        </div>

        <h4 className="eyebrow mt-6 flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 text-danger" aria-hidden /> Últimas grabaciones con error
        </h4>
        {system.failedRecordings.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              compact
              icon={Database}
              tone="muted"
              title="Sin errores en el pipeline"
              description="Ninguna grabación quedó en estado de error."
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {system.failedRecordings.map((r) => (
              <li key={r.id} className="rounded-2xl border border-danger/25 bg-danger/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title ?? "Grabación sin título"}</p>
                    <p className="truncate text-xs text-muted">
                      {r.class ? (
                        <>
                          {r.class.topic} · clase del {formatDate(r.class.class_date)}
                        </>
                      ) : (
                        "Clase eliminada"
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.current_step && (
                      <Badge tone="muted" size="sm">
                        paso: {r.current_step}
                      </Badge>
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{formatDateTime(r.created_at)}</span>
                  </div>
                </div>
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background/60 p-2.5 font-mono text-[11px] leading-relaxed text-danger">
                  {r.error_message ?? "Sin mensaje de error registrado."}
                </pre>
                {r.class && (
                  <Link
                    href={`/campus/docente/clases/${r.class.id}`}
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-accent-2 hover:underline"
                  >
                    Abrir la clase en el panel docente →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted lg:col-span-2">
        <KeyRound className="size-3.5" aria-hidden />
        Esta pestaña es de sólo lectura. Las acciones de regeneración de contenido IA viven en cada clase del panel docente.
      </p>
    </div>
  );
}

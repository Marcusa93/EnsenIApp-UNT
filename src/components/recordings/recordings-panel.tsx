import { AudioLines } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RecordingUploader } from "./recording-uploader";
import { RecordingRow, type RecordingRowData } from "./recording-row";

export interface RecordingsPanelProps {
  classId: string;
  courseId: string;
}

/**
 * Panel docente de grabaciones de una clase: uploader + lista con estado en vivo,
 * publicar/despublicar, reprocesar, eliminar y vista previa del material.
 * Lee con RLS (sólo docentes del curso / admin ven la lista).
 */
export async function RecordingsPanel({ classId, courseId }: RecordingsPanelProps) {
  const { user, profile } = await requireRole("docente", "admin");
  const supabase = await createClient();

  const isTeacher =
    profile.role === "admin" ||
    Boolean(
      (await supabase.from("teacher_assignments").select("course_id").eq("teacher_id", user.id).eq("course_id", courseId).maybeSingle()).data,
    );

  const { data, error } = await supabase
    .from("v_recording_status")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  const rows: RecordingRowData[] = (data ?? []).flatMap((r) =>
    r.id && r.status
      ? [
          {
            id: r.id,
            title: r.title,
            status: r.status,
            progress: r.progress ?? 0,
            current_step: r.current_step,
            chunks_total: r.chunks_total ?? 0,
            chunks_done: r.chunks_done ?? 0,
            published: r.published ?? false,
            duration_seconds: r.duration_seconds,
            created_at: r.created_at ?? new Date().toISOString(),
            error_message: r.error_message ?? null,
            has_transcript: r.has_transcript ?? false,
            has_summary: r.has_summary ?? false,
            has_cards: r.has_cards ?? false,
            has_simplified: r.has_simplified ?? false,
          },
        ]
      : [],
  );

  const published = rows.filter((r) => r.published).length;
  const inProgress = rows.filter((r) => r.status !== "ready" && r.status !== "error").length;

  return (
    <Card padding="md" className="flex flex-col gap-5">
      <CardHeader className="mb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle as="h2" eyebrow="Grabaciones">
            Grabaciones de la clase
          </CardTitle>
          <div className="flex items-center gap-2">
            {inProgress > 0 && (
              <Badge tone="accent" dot live size="sm">
                {inProgress} en proceso
              </Badge>
            )}
            <Badge tone={published > 0 ? "success" : "muted"} size="sm">
              {published}/{rows.length} publicadas
            </Badge>
          </div>
        </div>
        <CardDescription>
          Subí el audio o video de la clase: se comprime en tu navegador, se transcribe y la IA genera el material de
          estudio. Los estudiantes sólo ven las grabaciones publicadas.
        </CardDescription>
      </CardHeader>

      {isTeacher ? (
        <RecordingUploader classId={classId} userId={user.id} />
      ) : (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          No estás asignado como docente de este curso: podés ver las grabaciones pero no subir ni modificar.
        </p>
      )}

      {error ? (
        <EmptyState
          compact
          tone="muted"
          title="No se pudieron cargar las grabaciones"
          description={error.message}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon={AudioLines}
          title="Todavía no hay grabaciones en esta clase"
          description="Cuando subas la primera, vas a ver acá el progreso del procesamiento y el material generado para revisar antes de publicar."
        />
      ) : (
        <ol className="stagger flex flex-col gap-3" aria-label="Grabaciones">
          {rows.map((r, i) => (
            <RecordingRow key={r.id} recording={r} ordinal={rows.length - i} />
          ))}
        </ol>
      )}
    </Card>
  );
}

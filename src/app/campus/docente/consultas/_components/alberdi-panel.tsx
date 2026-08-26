import { Feather, ShieldAlert } from "lucide-react";
import type { DbClient } from "@/lib/courses";
import { Badge, Card, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { formatRelative } from "@/lib/format";

export interface AlberdiQuestion {
  id: string;
  content: string;
  created_at: string;
  student_name: string;
  class_topic: string | null;
  /** La siguiente respuesta de Alberdi quedó fuera de alcance. */
  refused: boolean;
}

export interface AlberdiPanelData {
  questions: AlberdiQuestion[];
  stats: { conversations: number; questions: number; refused: number; students: number };
}

const MAX_QUESTIONS = 60;

/** Consultas que los estudiantes le hicieron a Alberdi en este curso. */
export async function getAlberdiData(supabase: DbClient, courseId: string): Promise<AlberdiPanelData> {
  const { data: conversations, error } = await supabase
    .from("alberdi_conversations")
    .select("id, student_id, class_id, profiles(full_name), classes(topic)")
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[docente/alberdi] conversaciones", error);
    return { questions: [], stats: { conversations: 0, questions: 0, refused: 0, students: 0 } };
  }

  const convs = conversations ?? [];
  if (convs.length === 0) {
    return { questions: [], stats: { conversations: 0, questions: 0, refused: 0, students: 0 } };
  }

  const byId = new Map(convs.map((c) => [c.id, c]));
  const { data: messages } = await supabase
    .from("alberdi_messages")
    .select("id, conversation_id, role, content, refused, created_at")
    .in(
      "conversation_id",
      convs.map((c) => c.id),
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const all = messages ?? [];
  // Una consulta se marca "fuera de alcance" por la respuesta que vino después.
  const refusedConvTimes = new Set(
    all.filter((m) => m.role === "assistant" && m.refused).map((m) => `${m.conversation_id}`),
  );

  const questions: AlberdiQuestion[] = all
    .filter((m) => m.role === "user")
    .slice(0, MAX_QUESTIONS)
    .map((m) => {
      const conv = byId.get(m.conversation_id);
      const profile = conv?.profiles as { full_name: string } | null;
      const cls = conv?.classes as { topic: string } | null;
      return {
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        student_name: profile?.full_name ?? "Estudiante",
        class_topic: cls?.topic ?? null,
        refused: refusedConvTimes.has(m.conversation_id),
      };
    });

  return {
    questions,
    stats: {
      conversations: convs.length,
      questions: all.filter((m) => m.role === "user").length,
      refused: all.filter((m) => m.role === "assistant" && m.refused).length,
      students: new Set(convs.map((c) => c.student_id)).size,
    },
  };
}

export function AlberdiPanel({ data }: { data: AlberdiPanelData }) {
  if (data.questions.length === 0) {
    return (
      <EmptyState
        icon={Feather}
        title="Todavía nadie le consultó a Alberdi"
        description="Cuando los estudiantes empiecen a preguntarle sobre las clases vas a ver acá qué les cuesta, en sus propias palabras."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padding="sm" className="bg-surface-2/40">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">{data.stats.questions}</span> consultas de{" "}
          <span className="font-semibold text-foreground">{data.stats.students}</span>{" "}
          {data.stats.students === 1 ? "estudiante" : "estudiantes"}
          {data.stats.refused > 0 && (
            <>
              {" · "}
              <span className="text-warning">{data.stats.refused} fuera del alcance de la materia</span>
            </>
          )}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle eyebrow="En sus propias palabras">Qué le preguntan a Alberdi</CardTitle>
          <CardDescription>
            Lo que los estudiantes consultan sobre las clases. Sirve para detectar qué conviene reforzar.
          </CardDescription>
        </CardHeader>

        <ul className="flex flex-col gap-2">
          {data.questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-border bg-surface-2/60 p-3">
              <p className="text-sm leading-snug">{q.content}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-medium text-foreground/80">{q.student_name}</span>
                <span aria-hidden>·</span>
                <span>{formatRelative(q.created_at)}</span>
                {q.class_topic && (
                  <Badge tone="muted" size="sm" className="max-w-[16rem] truncate">
                    {q.class_topic}
                  </Badge>
                )}
                {q.refused && (
                  <Badge tone="warning" size="sm">
                    <ShieldAlert className="size-3" aria-hidden /> fuera de alcance
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

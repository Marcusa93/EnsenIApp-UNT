import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getPrimaryCourse } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, EmptyState, PageHeader } from "@/components/ui";
import { AlberdiChat } from "./chat";

export const metadata: Metadata = { title: "Alberdi · EnsenIA UNT" };

/** Sugerencias armadas con las clases reales, para no ofrecer temas que no existen. */
function buildSuggestions(classes: { topic: string }[], focusTopic: string | null): string[] {
  if (focusTopic) {
    return [
      `¿Cuáles son las ideas principales de "${focusTopic}"?`,
      `Explicame en lenguaje simple lo más difícil de esta clase`,
      `¿Qué conviene repasar de este tema para el examen?`,
    ];
  }
  const out: string[] = [];
  if (classes[0]) out.push(`¿De qué trata "${classes[0].topic}"?`);
  out.push("¿Qué temas vamos a ver en la materia?");
  if (classes[1]) out.push(`Explicame los conceptos clave de "${classes[1].topic}"`);
  return out.slice(0, 3);
}

export default async function AlberdiPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { user, profile } = await requireUser("/campus/estudiante/alberdi");
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="Asistente de la materia" title="Alberdi" />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no estás en ninguna comisión"
          description="Cuando el equipo docente te agregue vas a poder consultarle a Alberdi sobre las clases."
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/estudiante">Volver a Hoy</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { classId } = await searchParams;
  const focusId = classId && /^[0-9a-f-]{36}$/i.test(classId) ? classId : null;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, topic")
    .eq("course_id", course.id)
    .order("class_date", { ascending: false })
    .limit(10);

  const classList = classes ?? [];
  const focus = focusId ? (classList.find((c) => c.id === focusId) ?? null) : null;

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
      <PageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Asistente de la materia</span>
            {focus && (
              <Badge tone="accent-2" size="sm">
                {focus.topic}
              </Badge>
            )}
          </span>
        }
        title="Alberdi"
        description="Consultá sobre los temas de la cursada. Responde con el material que carga la cátedra: clases, resúmenes y bibliografía."
        actions={
          focus ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/campus/estudiante/alberdi">Consultar sobre toda la materia</Link>
            </Button>
          ) : undefined
        }
      />

      <AlberdiChat
        courseId={course.id}
        studentFirstName={profile.full_name.split(" ")[0] ?? profile.full_name}
        focus={focus}
        suggestions={buildSuggestions(classList, focus?.topic ?? null)}
        hasContent={classList.length > 0}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCoursesForRole } from "@/lib/courses";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { NewDebateForm, type ClassOption, type CourseOption, type RecordingOption } from "./_components/new-debate-form";

export const metadata: Metadata = { title: "Nuevo debate · EnsenIA UNT" };

interface PageProps {
  searchParams: Promise<{ classId?: string; recordingId?: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: string | undefined) => (v && UUID_RE.test(v) ? v : null);

export default async function NewDebatePage({ searchParams }: PageProps) {
  const { user, profile } = await requireRole("docente", "admin");
  const sp = await searchParams;
  const supabase = await createClient();

  const courses = await getCoursesForRole(supabase, user.id, profile.role);
  const courseIds = courses.map((c) => c.id);

  let classes: ClassOption[] = [];
  let recordings: RecordingOption[] = [];

  if (courseIds.length > 0) {
    const { data: classRows, error: classError } = await supabase
      .from("classes")
      .select("id, course_id, topic, class_date")
      .in("course_id", courseIds)
      .order("class_date", { ascending: false });
    if (classError) {
      console.error("[debates] nuevo classes", { error: classError });
      throw new Error("No se pudieron cargar las clases.");
    }
    classes = classRows ?? [];

    if (classes.length > 0) {
      const { data: recRows, error: recError } = await supabase
        .from("class_recordings")
        .select("id, class_id, title, status, created_at")
        .in(
          "class_id",
          classes.map((c) => c.id),
        )
        .order("created_at", { ascending: false });
      if (recError) {
        console.error("[debates] nuevo recordings", { error: recError });
        throw new Error("No se pudieron cargar las grabaciones.");
      }
      recordings = (recRows ?? []).map((r) => ({
        id: r.id,
        class_id: r.class_id,
        title: r.title,
        ready: r.status === "ready",
      }));
    }
  }

  const courseOptions: CourseOption[] = courses.map((c) => ({ id: c.id, name: c.name, term: c.term }));

  return (
    <div>
      <Link
        href="/campus/debates"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Debates
      </Link>
      <PageHeader
        eyebrow="Docente · Debates"
        title="Nuevo debate"
        description="Planteá una controversia ligada a una clase. Podés pedirle a la IA que proponga título, contexto y posturas a partir de la grabación."
      />

      {courseOptions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No tenés cursos asignados"
          description="Para abrir un debate necesitás estar asignado a un curso. Pedile al administrador que te asigne."
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/docente">Volver al panel</Link>
            </Button>
          }
        />
      ) : (
        <NewDebateForm
          courses={courseOptions}
          classes={classes}
          recordings={recordings}
          initialClassId={clean(sp.classId)}
          initialRecordingId={clean(sp.recordingId)}
        />
      )}
    </div>
  );
}

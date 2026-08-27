import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCourse } from "@/lib/courses";
import { CampusShell } from "@/components/shell/campus-shell";
import { BadgeCelebration } from "@/components/gamification/badge-celebration";
import { FloatingAlberdi } from "@/components/alberdi/floating-alberdi";

export default async function CampusLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser("/campus");
  const isStudent = profile.role === "estudiante";
  // Sólo se resuelve para estudiante: es quien tiene a Alberdi como canal de consulta.
  const course = isStudent ? await getPrimaryCourse(await createClient(), user.id, profile.role) : null;
  return (
    <CampusShell
      profile={profile}
      overlays={
        <>
          {isStudent && <BadgeCelebration userId={user.id} />}
          {/* Círculo flotante y arrastrable: disponible en cualquier pantalla del campus,
              no sólo dentro de una clase, para poder consultar sobre lo que sea en cualquier
              momento. Va en `overlays` (fuera de la transición entre páginas) para no perder
              la conversación abierta ni la posición cada vez que se navega. */}
          {course && <FloatingAlberdi courseId={course.id} />}
        </>
      }
    >
      {children}
    </CampusShell>
  );
}

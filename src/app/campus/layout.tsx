import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCourse } from "@/lib/courses";
import { CampusShell } from "@/components/shell/campus-shell";
import { BadgeCelebration } from "@/components/gamification/badge-celebration";
import { FloatingAlberdi } from "@/components/alberdi/floating-alberdi";
import { ConsentGate } from "@/components/consentimiento/consent-gate";
import { faltaDecidir } from "@/lib/consentimiento/actions";

export default async function CampusLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser("/campus");
  const isStudent = profile.role === "estudiante";

  // Sólo se resuelve para estudiante: es quien tiene a Alberdi como canal de consulta.
  const supabase = isStudent ? await createClient() : null;
  const course = supabase ? await getPrimaryCourse(supabase, user.id, profile.role) : null;

  // Las clases alimentan el selector de contexto de Alberdi ("¿sobre qué querés
  // consultar?"). Van acá y no en cada página porque el panel flotante vive en el
  // layout; son dos columnas de una tabla chica, así que el costo es despreciable.
  const { data: classRows } = course
    ? await supabase!
        .from("classes")
        .select("id, topic, class_date")
        .eq("course_id", course.id)
        .order("class_date", { ascending: false })
    : { data: null };

  const classes = (classRows ?? []).map((c) => ({ id: c.id, topic: c.topic, date: c.class_date }));

  // El consentimiento se pregunta una sola vez por versión del texto; quien ya
  // decidió (sí o no) no lo vuelve a ver.
  const pedirConsentimiento = await faltaDecidir();

  return (
    <CampusShell
      profile={profile}
      overlays={
        <>
          {isStudent && <BadgeCelebration userId={user.id} />}
          {pedirConsentimiento && <ConsentGate />}
          {/* Círculo flotante y arrastrable: disponible en cualquier pantalla del campus,
              no sólo dentro de una clase, para poder consultar sobre lo que sea en cualquier
              momento. Va en `overlays` (fuera de la transición entre páginas) para no perder
              la conversación abierta ni la posición cada vez que se navega. */}
          {course && <FloatingAlberdi courseId={course.id} classes={classes} />}
        </>
      }
    >
      {children}
    </CampusShell>
  );
}

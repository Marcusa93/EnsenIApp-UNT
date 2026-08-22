import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openrouter, MODELS } from "@/lib/openrouter";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const form = await request.formData();
  const courseId = form.get("courseId")?.toString();
  if (!courseId) {
    return NextResponse.redirect(new URL("/campus/docente", request.url));
  }

  const admin = createAdminClient();

  const { data: reportRow } = await admin
    .from("report_requests")
    .insert({ requested_by: user.id, course_id: courseId, scope: "uso_y_consultas", status: "processing" })
    .select()
    .single();

  const { data: checkins } = await admin
    .from("student_checkins")
    .select("difficulty, comment, classes!inner(topic, course_id)")
    .eq("classes.course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: events } = await admin
    .from("usage_events")
    .select("event_type, entity_type, created_at")
    .limit(500);

  const prompt = `Datos de consultas de alumnos (dificultad 1-5 y comentarios):\n${JSON.stringify(
    checkins,
  )}\n\nEventos de uso recientes:\n${JSON.stringify(events)}\n\nGenerá un informe breve en Markdown para el equipo docente: qué temas generan más dificultad, patrones de uso del campus, y 3 recomendaciones concretas para mejorar la cursada.`;

  const completion = await openrouter.chat.completions.create({
    model: MODELS.reasoning,
    messages: [
      { role: "system", content: "Sos un analista pedagógico que ayuda a mejorar un campus digital universitario." },
      { role: "user", content: prompt },
    ],
  });

  const resultMd = completion.choices[0]?.message?.content ?? "Sin datos suficientes.";

  if (reportRow) {
    await admin
      .from("report_requests")
      .update({ status: "ready", result_md: resultMd, completed_at: new Date().toISOString() })
      .eq("id", reportRow.id);
  }

  return NextResponse.redirect(new URL("/campus/docente", request.url));
}

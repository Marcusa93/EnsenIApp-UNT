import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatText, LLMError } from "@/lib/ai/llm";
import { inlineUntrusted, UNTRUSTED_CONTENT_RULE } from "@/lib/ai/untrusted";
import { MODELS } from "@/lib/openrouter";
import { getPrimaryCourse } from "@/lib/courses";
import { parseCards } from "@/components/class-content/parse";
import { todayKey } from "@/app/campus/estudiante/_components/student-data";
import { errorMessage } from "@/lib/utils";

export const maxDuration = 180;

/** Rate limit simple: una devolución cada 10 minutos por estudiante. */
const MIN_INTERVAL_MS = 10 * 60 * 1000;

const SYSTEM_PROMPT = `Sos el tutor pedagógico del campus de la materia "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI" (Abogacía, Universidad Nacional de Tucumán).
Escribís una devolución personalizada para UN estudiante a partir de sus datos de cursada. Español rioplatense (voseo), tono cercano, honesto y motivador, sin condescendencia ni frases vacías.

Reglas:
- Hablale directamente al estudiante por su nombre de pila.
- Usá SÓLO los datos que te paso. Si hay poca información, decilo y orientá a cómo generar más (usar placas, hacer check-ins, entregar actividades).
- No inventes notas, temas ni hechos. No menciones identificadores técnicos.
- Formato Markdown con exactamente estas secciones (encabezados de nivel 2):
  ## Qué va bien
  ## Qué conviene reforzar
  ## Tu plan para esta semana
  (El plan: 3 pasos concretos, numerados, accionables en el campus o con el material de la materia, cada uno en 1–2 líneas.)
- Cerrá con una línea breve de aliento (sin encabezado).
- Extensión total: 220–450 palabras.

${UNTRUSTED_CONTENT_RULE}`;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function firstName(full: string | null | undefined): string {
  return full?.trim().split(/\s+/)[0] ?? "estudiante";
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * POST /api/feedback/generate
 * Genera (y guarda en ai_feedback) una devolución personalizada para el estudiante autenticado.
 */
export async function POST() {
  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.role !== "estudiante") {
    return NextResponse.json({ error: "La devolución personalizada es para estudiantes." }, { status: 403 });
  }
  const studentId = auth.user.id;
  const supabase = await createClient();

  // --- Rate limit ---
  const { data: last, error: lastErr } = await supabase
    .from("ai_feedback")
    .select("created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) {
    console.error("[feedback/generate] último feedback", lastErr);
    return NextResponse.json({ error: "No pudimos verificar tu última devolución." }, { status: 500 });
  }
  if (last) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < MIN_INTERVAL_MS) {
      const waitMin = Math.ceil((MIN_INTERVAL_MS - elapsed) / 60000);
      return NextResponse.json(
        {
          error: `Ya generaste una devolución hace poco. Podés pedir otra en ${waitMin} ${waitMin === 1 ? "minuto" : "minutos"}.`,
          retry_after_seconds: Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000),
        },
        { status: 429 },
      );
    }
  }

  // --- Datos del estudiante (todo con RLS: sólo lo propio) ---
  let course: Awaited<ReturnType<typeof getPrimaryCourse>> = null;
  try {
    course = await getPrimaryCourse(supabase, studentId, auth.profile.role);
  } catch (err) {
    console.error("[feedback/generate] curso", err);
  }

  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [checkinsRes, progressRes, submissionsRes, questionsRes, eventsRes, classesRes] = await Promise.all([
    supabase
      .from("student_checkins")
      .select("difficulty, comment, created_at, class:classes(topic, class_date)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("card_progress")
      .select("recording_id, card_index, known, attempts, correct")
      .eq("student_id", studentId)
      .limit(600),
    supabase
      .from("activity_submissions")
      .select("status, auto_score, score, teacher_feedback_md, submitted_at, activity:activities(title, type)")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false })
      .limit(30),
    supabase
      .from("student_questions")
      .select("question, status, created_at, class:classes(topic)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("usage_events")
      .select("event_type, entity_id, created_at")
      .eq("student_id", studentId)
      .gte("created_at", since30d)
      .limit(3000),
    course
      ? supabase.from("classes").select("id, topic, class_date").eq("course_id", course.id).order("class_date")
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const [name, res] of [
    ["student_checkins", checkinsRes],
    ["card_progress", progressRes],
    ["activity_submissions", submissionsRes],
    ["student_questions", questionsRes],
    ["usage_events", eventsRes],
    ["classes", classesRes],
  ] as const) {
    if (res.error) {
      console.error(`[feedback/generate] ${name}`, res.error);
      return NextResponse.json({ error: "No pudimos reunir tus datos de cursada. Probá de nuevo." }, { status: 500 });
    }
  }

  // --- Placas: tags débiles a partir de card_progress + interactive_cards ---
  const progress = progressRes.data ?? [];
  const recordingIds = Array.from(new Set(progress.map((p) => p.recording_id)));
  const weakTags = new Map<string, number>();
  const strongTags = new Map<string, number>();
  if (recordingIds.length > 0) {
    const { data: cardSets, error: cardsErr } = await supabase
      .from("interactive_cards")
      .select("recording_id, cards, created_at")
      .in("recording_id", recordingIds)
      .order("created_at", { ascending: false });
    if (cardsErr) console.error("[feedback/generate] interactive_cards", cardsErr);
    const latestByRecording = new Map<string, ReturnType<typeof parseCards>>();
    for (const set of cardSets ?? []) {
      if (!latestByRecording.has(set.recording_id)) latestByRecording.set(set.recording_id, parseCards(set.cards));
    }
    for (const p of progress) {
      const card = latestByRecording.get(p.recording_id)?.find((c) => c.index === p.card_index)?.card;
      const tag = card?.tag?.trim();
      if (!tag) continue;
      const weak = !p.known || (p.attempts > 0 && p.correct / p.attempts < 0.5);
      const map = weak ? weakTags : strongTags;
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  const topTags = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t, n]) => `${t} (${n})`);

  const known = progress.filter((p) => p.known).length;
  const attempts = progress.reduce((a, p) => a + p.attempts, 0);
  const correct = progress.reduce((a, p) => a + p.correct, 0);

  // --- Eventos: clases abiertas, actividad por tipo ---
  const events = eventsRes.data ?? [];
  const classesOpened = new Set(events.filter((e) => e.event_type === "class_opened" && e.entity_id).map((e) => e.entity_id));
  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.event_type, (byType.get(e.event_type) ?? 0) + 1);
  const activeDays = new Set(events.map((e) => e.created_at.slice(0, 10))).size;

  const checkins = (checkinsRes.data ?? []).map((c) => ({ ...c, class: one(c.class) }));
  const avgDifficulty = checkins.length ? checkins.reduce((a, c) => a + c.difficulty, 0) / checkins.length : null;
  const submissions = (submissionsRes.data ?? []).map((s) => ({ ...s, activity: one(s.activity) }));
  const questions = (questionsRes.data ?? []).map((q) => ({ ...q, class: one(q.class) }));
  const classes = classesRes.data ?? [];
  const today = todayKey();
  const pastClasses = classes.filter((c) => c.class_date <= today);

  const dataset = [
    `ESTUDIANTE: ${firstName(auth.profile.full_name)}`,
    course ? `CURSO: ${course.name}${course.subject?.name ? ` — ${course.subject.name}` : ""}` : "CURSO: sin inscripción activa",
    `\nCRONOGRAMA: ${classes.length} clases en total, ${pastClasses.length} ya dictadas. Clases abiertas en el campus (últimos 30 días): ${classesOpened.size}.`,
    pastClasses.length ? `Temas dictados: ${pastClasses.map((c) => `"${c.topic}" (${c.class_date})`).join("; ")}` : null,
    `\nACTIVIDAD EN EL CAMPUS (30 días): ${events.length} acciones en ${activeDays} días distintos. Por tipo: ${
      Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${t}=${n}`)
        .join(", ") || "sin actividad registrada"
    }.`,
    `\nCHECK-INS DE DIFICULTAD (1 = muy fácil, 5 = muy difícil): ${checkins.length} registrados${
      avgDifficulty != null ? `, promedio ${avgDifficulty.toFixed(1)}` : ""
    }.`,
    ...checkins.slice(0, 15).map(
      (c) =>
        `- ${fmtDate(c.created_at)} · "${c.class?.topic ?? "clase"}" · dificultad ${c.difficulty}${c.comment ? ` · comentario: "${inlineUntrusted(c.comment).slice(0, 300)}"` : ""}`,
    ),
    `\nPLACAS INTERACTIVAS: ${progress.length} placas vistas, ${known} marcadas como sabidas, ${correct}/${attempts} respuestas correctas en quiz.`,
    weakTags.size ? `Temas con dificultad en placas: ${topTags(weakTags).join(", ")}.` : null,
    strongTags.size ? `Temas dominados en placas: ${topTags(strongTags).join(", ")}.` : null,
    `\nACTIVIDADES (${submissions.length} iniciadas):`,
    ...submissions.slice(0, 15).map((s) => {
      const scoreTxt = s.score != null ? `nota ${s.score}` : s.auto_score != null ? `puntaje automático ${s.auto_score}` : "sin nota";
      return `- "${s.activity?.title ?? "actividad"}" (${s.activity?.type ?? "?"}) · estado ${s.status} · ${scoreTxt}${
        s.teacher_feedback_md ? ` · feedback docente: "${s.teacher_feedback_md.slice(0, 240)}"` : ""
      }`;
    }),
    `\nCONSULTAS (${questions.length}):`,
    ...questions.slice(0, 10).map(
      (q) => `- ${fmtDate(q.created_at)} · ${q.status}${q.class?.topic ? ` · clase "${q.class.topic}"` : ""} · "${inlineUntrusted(q.question).slice(0, 200)}"`,
    ),
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");

  try {
    const result = await chatText({
      system: SYSTEM_PROMPT,
      user: `Datos de cursada del estudiante (generados por el campus):\n\n${dataset}\n\nEscribí la devolución.`,
      // Feedback corto sobre datos ya digeridos: tarea del modelo fast (ARCHITECTURE §6).
      model: MODELS.fast,
      temperature: 0.5,
      maxTokens: 1600,
    });
    const feedbackMd = result.data.trim();

    // ai_feedback no tiene política de insert para el estudiante: se guarda con service role
    // después de haber verificado sesión y rol arriba.
    const admin = createAdminClient();

    // Guarda contra doble POST concurrente: si mientras corría el LLM otro request
    // ya insertó una devolución nueva, devolvemos esa en vez de duplicar.
    const { data: concurrent } = await admin
      .from("ai_feedback")
      .select("id, feedback_md, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (concurrent && concurrent.created_at !== (last?.created_at ?? null)) {
      return NextResponse.json({ id: concurrent.id, feedback_md: concurrent.feedback_md, created_at: concurrent.created_at });
    }

    const { data: inserted, error: insErr } = await admin
      .from("ai_feedback")
      .insert({ student_id: studentId, feedback_md: feedbackMd, model: result.model })
      .select("id, feedback_md, created_at")
      .single();
    if (insErr || !inserted) {
      console.error("[feedback/generate] insert", { studentId, insErr });
      return NextResponse.json({ error: "Se generó la devolución pero no se pudo guardar." }, { status: 500 });
    }

    return NextResponse.json({ id: inserted.id, feedback_md: inserted.feedback_md, created_at: inserted.created_at });
  } catch (err) {
    const message =
      err instanceof LLMError ? err.message : errorMessage(err, "No pudimos generar tu devolución. Probá de nuevo en unos minutos.");
    console.error("[feedback/generate] error", { studentId, err });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

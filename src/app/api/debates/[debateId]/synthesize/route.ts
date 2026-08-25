import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatText, LLMError } from "@/lib/ai/llm";
import { fenceUntrusted, inlineUntrusted, UNTRUSTED_CONTENT_RULE } from "@/lib/ai/untrusted";
import { MODELS } from "@/lib/openrouter";
import { STANCE_META } from "@/components/debates/stance";
import { canModerateCourse, getVisibleArgumentsForSynthesis } from "@/app/campus/debates/_lib/data";

export const maxDuration = 300;

const paramsSchema = z.object({ debateId: z.string().guid() });

/**
 * POST /api/debates/[debateId]/synthesize
 * Genera la síntesis IA del debate (sólo docente del curso / admin) y la guarda en debates.ai_synthesis_md.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ debateId: string }> }) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const { debateId } = parsed.data;

  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.status === "bloqueado") return NextResponse.json({ error: "Tu cuenta está bloqueada." }, { status: 403 });

  const supabase = await createClient();
  const { data: debate, error: debateError } = await supabase
    .from("debates")
    .select("id, course_id, title, context_md, status, closes_at, class:classes(topic, summary), recording:class_recordings(id)")
    .eq("id", debateId)
    .maybeSingle();
  if (debateError) {
    console.error("[debates] synthesize load", { debateId, error: debateError });
    return NextResponse.json({ error: "No se pudo cargar el debate." }, { status: 500 });
  }
  if (!debate) return NextResponse.json({ error: "El debate no existe o no tenés acceso." }, { status: 404 });

  const allowed = await canModerateCourse(supabase, auth.user.id, auth.profile.role, debate.course_id);
  if (!allowed) {
    return NextResponse.json({ error: "Sólo el equipo docente del curso puede sintetizar este debate." }, { status: 403 });
  }

  let args: Awaited<ReturnType<typeof getVisibleArgumentsForSynthesis>>;
  try {
    args = await getVisibleArgumentsForSynthesis(supabase, debateId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al leer argumentos." }, { status: 500 });
  }
  if (args.length === 0) {
    return NextResponse.json({ error: "No hay argumentos visibles para sintetizar." }, { status: 422 });
  }

  // Resumen de la clase vinculada (si la grabación tiene summary) para conectar la síntesis con el contenido.
  const cls = Array.isArray(debate.class) ? debate.class[0] : debate.class;
  const rec = Array.isArray(debate.recording) ? debate.recording[0] : debate.recording;
  let classSummary: string | null = null;
  if (rec?.id) {
    const { data: summary } = await supabase.from("class_summaries").select("summary_md").eq("recording_id", rec.id).maybeSingle();
    classSummary = summary?.summary_md?.slice(0, 12_000) ?? null;
  }

  // Cotas de entrada al modelo: cada argumento se trunca y, si el total excede el
  // presupuesto, se priorizan los más apoyados (el resto se omite y se loguea).
  const MAX_ARG_CHARS = 1500;
  const MAX_TOTAL_CHARS = 120_000;
  let includedArgs = args;
  {
    let total = 0;
    const keep = new Set<string>();
    for (const a of [...args].sort((x, y) => y.supports - x.supports)) {
      const cost = Math.min(a.content.length, MAX_ARG_CHARS) + 120;
      if (total + cost > MAX_TOTAL_CHARS) continue;
      total += cost;
      keep.add(a.id);
    }
    if (keep.size < args.length) {
      console.warn("[debates] synthesize: entrada recortada", { debateId, total: args.length, included: keep.size });
      includedArgs = args.filter((a) => keep.has(a.id));
    }
  }
  const clip = (text: string) => (text.length > MAX_ARG_CHARS ? `${text.slice(0, MAX_ARG_CHARS - 1)}…` : text);

  // Agrupar por postura, con hilos aplanados a "respuesta a #id".
  const byId = new Map(args.map((a) => [a.id, a]));
  const grouped = (["a_favor", "en_contra", "neutral"] as const).map((s) => {
    const items = includedArgs
      .filter((a) => a.stance === s)
      .map((a) => {
        const parent = a.parent_id ? byId.get(a.parent_id) : null;
        const head = `[#${a.id.slice(0, 6)}] ${inlineUntrusted(a.author)} · ${a.supports} ${a.supports === 1 ? "apoyo" : "apoyos"}${parent ? ` · responde a #${parent.id.slice(0, 6)}` : ""}`;
        return `${head}\n${fenceUntrusted(clip(a.content))}`;
      });
    return `## ${STANCE_META[s].label} (${items.length})\n\n${items.length ? items.join("\n\n---\n\n") : "(sin argumentos)"}`;
  });

  const user = [
    `# Debate: ${debate.title}`,
    debate.context_md ? `## Contexto planteado por el docente\n${debate.context_md}` : null,
    cls ? `## Clase vinculada\n${cls.topic}${cls.summary ? `\n${cls.summary}` : ""}` : null,
    classSummary ? `## Resumen de la clase grabada\n${classSummary}` : null,
    `# Argumentos (${args.length})`,
    ...grouped,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await chatText({
      model: MODELS.reasoning,
      temperature: 0.3,
      maxTokens: 3500,
      system: `Sos docente de "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI" (Abogacía, UNT) y vas a cerrar un debate de estudiantes con una síntesis pedagógica.
Escribí en español rioplatense (voseo), en Markdown, con estas secciones (usá exactamente estos títulos de nivel 2):
1. **Mapa del debate** — las líneas argumentales principales de cada postura, agrupadas por idea (no por persona). Mencioná a los autores por nombre cuando aportaron algo distintivo; nunca ridiculices a nadie.
2. **Puntos fuertes de cada postura** — qué argumentos fueron más sólidos y por qué (fundamento normativo, jurisprudencial, conceptual).
3. **Falacias y puntos débiles** — argumentos circulares, de autoridad, apelaciones emocionales, afirmaciones sin fuente, confusiones conceptuales. Señalá el patrón con tono constructivo.
4. **Preguntas para seguir** — 3 a 5 preguntas que quedaron abiertas y valen para una próxima clase o trabajo.
5. **Conexión con la clase** — cómo se relaciona lo discutido con los contenidos de la clase vinculada (si hay material, citalo; si no, con los conceptos del contexto).
Cerrá con una frase breve que reconozca la participación. No inventes argumentos que no estén en el material. No declares ganador. Máximo ~900 palabras.

${UNTRUSTED_CONTENT_RULE}`,
      user,
    });

    const synthesis = result.data.trim();
    const { error: updateError } = await supabase.from("debates").update({ ai_synthesis_md: synthesis }).eq("id", debateId);
    if (updateError) {
      console.error("[debates] synthesize save", { debateId, error: updateError });
      return NextResponse.json({ error: "La síntesis se generó pero no se pudo guardar." }, { status: 500 });
    }

    revalidatePath(`/campus/debates/${debateId}`);
    revalidatePath("/campus/debates");
    return NextResponse.json({ synthesis_md: synthesis, model: result.model, usage: result.usage });
  } catch (err) {
    console.error("[debates] synthesize llm", { debateId, err });
    const message = err instanceof LLMError || err instanceof Error ? err.message : "No se pudo generar la síntesis.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

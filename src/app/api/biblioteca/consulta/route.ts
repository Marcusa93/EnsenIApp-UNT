import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatJSON } from "@/lib/ai/llm";
import { MODELS, assertOpenRouterConfigured } from "@/lib/openrouter";

export const maxDuration = 60;

/**
 * Alberdi bibliotecario.
 *
 * A diferencia del chat, acá NO redacta a partir de un contexto: primero se
 * busca de verdad en la base (clases, resúmenes, glosarios, materiales) y recién
 * después arma una respuesta corta sobre lo que EXISTE. Así lo que te alcanza es
 * siempre material real del campus, con su enlace, y no una recomendación
 * inventada — que en una biblioteca sería el peor error posible.
 */

const schema = z.object({
  pedido: z.string().trim().min(2, "Contame qué buscás.").max(300),
});

export interface Hallazgo {
  kind: "clase" | "material" | "glosario";
  title: string;
  subtitle: string;
  href: string;
}

/** Palabras que no aportan a la búsqueda. */
const VACIAS = new Set([
  "el","la","los","las","un","una","de","del","que","y","o","en","para","con","por","sobre","como",
  "me","te","se","lo","al","es","son","hay","tenes","tenés","tiene","quiero","busco","dame","pasame",
  "algo","cosa","tema","clase","material","info","informacion","información",
]);

function terminos(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !VACIAS.has(w))
    .slice(0, 6);
}

/** ¿Está pidiendo jugar en vez de buscar material? */
function pideJugar(texto: string): boolean {
  return /\b(jugar|juego|partida|desafi|desafío|jueguito|trivia|practicar)\b/i.test(texto);
}

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión expiró. Volvé a ingresar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido." }, { status: 400 });
  }
  const { pedido } = parsed.data;

  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", ctx.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: "Todavía no estás en ninguna comisión." }, { status: 403 });
  const courseId = enrollment.course_id;

  // Si quiere jugar, no hay nada que buscar.
  if (pideJugar(pedido)) {
    return NextResponse.json({
      intencion: "jugar",
      respuesta: "Dale. Tenés tres juegos armados con lo que se dijo en clase — elegí cuál y arrancamos.",
      hallazgos: [],
    });
  }

  const palabras = terminos(pedido);
  if (palabras.length === 0) {
    return NextResponse.json({
      intencion: "buscar",
      respuesta: "Decime un tema concreto y lo busco entre las clases y los materiales de la materia.",
      hallazgos: [],
    });
  }

  // Búsqueda real: cada término contra los campos que importan.
  const orClases = palabras.map((w) => `topic.ilike.%${w}%,summary.ilike.%${w}%`).join(",");
  const orMateriales = palabras.map((w) => `title.ilike.%${w}%`).join(",");

  const [clasesRes, materialesRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, topic, class_date, summary")
      .eq("course_id", courseId)
      .or(orClases)
      .order("class_date", { ascending: false })
      .limit(6),
    supabase
      .from("class_materials")
      .select("id, title, url, class_id, classes(topic, course_id)")
      .or(orMateriales)
      .limit(6),
  ]);

  const hallazgos: Hallazgo[] = [];

  for (const c of clasesRes.data ?? []) {
    hallazgos.push({
      kind: "clase",
      title: c.topic,
      subtitle: c.class_date,
      href: `/campus/estudiante/clases/${c.id}`,
    });
  }

  for (const m of materialesRes.data ?? []) {
    const cls = m.classes as { topic: string; course_id: string } | null;
    // El join no filtra por curso: se descarta acá lo de otras comisiones.
    if (!cls || cls.course_id !== courseId) continue;
    hallazgos.push({
      kind: "material",
      title: m.title,
      subtitle: cls.topic,
      href: m.class_id ? `/campus/estudiante/clases/${m.class_id}` : (m.url ?? "#"),
    });
  }

  // Glosarios: se filtran en memoria porque viven dentro de un jsonb.
  const { data: resumenes } = await supabase
    .from("class_summaries")
    .select("glossary, recording_id, class_recordings(class_id, classes(topic, course_id))")
    .limit(40);

  for (const r of resumenes ?? []) {
    const rec = r.class_recordings as { class_id: string; classes: { topic: string; course_id: string } | null } | null;
    if (!rec?.classes || rec.classes.course_id !== courseId) continue;
    const glosario = Array.isArray(r.glossary) ? (r.glossary as { term?: string; definition?: string }[]) : [];
    for (const g of glosario) {
      if (!g?.term) continue;
      const termNorm = g.term.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (!palabras.some((w) => termNorm.includes(w))) continue;
      hallazgos.push({
        kind: "glosario",
        title: g.term,
        subtitle: g.definition?.slice(0, 110) ?? rec.classes.topic,
        href: `/campus/estudiante/clases/${rec.class_id}`,
      });
      if (hallazgos.length > 12) break;
    }
  }

  const encontrados = hallazgos.slice(0, 8);

  if (encontrados.length === 0) {
    return NextResponse.json({
      intencion: "buscar",
      respuesta:
        "No encontré nada de eso en lo que la cátedra tiene cargado. Puede que todavía no se haya dado esa clase, o que el tema se llame distinto acá.",
      hallazgos: [],
    });
  }

  // La redacción se hace SOBRE lo encontrado, nunca por fuera.
  let respuesta = `Encontré ${encontrados.length} ${encontrados.length === 1 ? "cosa" : "cosas"} sobre eso.`;
  try {
    assertOpenRouterConfigured();
    const res = await chatJSON({
      system: `Sos Alberdi, bibliotecario de la cátedra "Derecho de las Nuevas Tecnologías y Bioderecho" (UNT).
Hablás en español rioplatense, breve y directo, como quien atiende un mostrador.
Te paso lo que YA se encontró en el catálogo: tu tarea es presentarlo en UNA o DOS oraciones.
No inventes materiales, clases ni temas que no estén en la lista. No enumeres todo: mencioná lo más pertinente y dejá que la lista hable.`,
      user: `El estudiante pidió: "${pedido}"

Resultados del catálogo:
${encontrados.map((h) => `- [${h.kind}] ${h.title} (${h.subtitle})`).join("\n")}`,
      schema: z.object({ respuesta: z.string().trim().min(4).max(300) }),
      model: MODELS.fast,
      temperature: 0.5,
      maxTokens: 300,
    });
    respuesta = res.data.respuesta;
  } catch (err) {
    // Si la IA falla, la lista de resultados sigue sirviendo igual.
    console.error("[biblioteca] redacción", err);
  }

  return NextResponse.json({ intencion: "buscar", respuesta, hallazgos: encontrados });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openrouter, MODELS, assertOpenRouterConfigured } from "@/lib/openrouter";
import { buildAlberdiContext } from "@/lib/alberdi/context";
import { buildSystemPrompt, wrapUserMessage, OUT_OF_SCOPE_MARKER } from "@/lib/alberdi/prompt";
import { uuidSchema } from "@/components/docente/class-schema";
import type { Json } from "@/lib/types/database";

export const maxDuration = 120;

const schema = z.object({
  conversationId: uuidSchema.nullable().optional(),
  courseId: uuidSchema,
  classId: uuidSchema.nullable().optional(),
  message: z.string().trim().min(1, "Escribí tu consulta.").max(2000, "Máximo 2000 caracteres."),
});

/** Turnos de ida y vuelta que se le pasan al modelo como memoria de la charla. */
const HISTORY_TURNS = 12;
/** Anti-abuso: mensajes por estudiante en la ventana. */
const RATE_LIMIT = { max: 30, windowMinutes: 10 };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ctx = await getOptionalUser();
  if (!ctx) return errorResponse("Tu sesión expiró. Volvé a ingresar.", 401);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Consulta inválida.", 400);
  }
  const { courseId, classId, message } = parsed.data;

  try {
    assertOpenRouterConfigured();
  } catch {
    return errorResponse("Alberdi no está configurado todavía. Avisale al equipo docente.", 503);
  }

  const supabase = await createClient();

  // Sólo se consulta sobre un curso en el que estás inscripto (RLS lo refuerza,
  // pero lo verificamos acá para dar un error claro).
  const { data: enrolled } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", ctx.user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  const isTeacher = ctx.profile.role === "docente" || ctx.profile.role === "admin";
  if (!enrolled && !isTeacher) {
    return errorResponse("No estás inscripto en esta comisión.", 403);
  }

  const admin = createAdminClient();

  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
  const { count: recent } = await admin
    .from("alberdi_messages")
    .select("id, alberdi_conversations!inner(student_id)", { count: "exact", head: true })
    .eq("role", "user")
    .eq("alberdi_conversations.student_id", ctx.user.id)
    .gte("created_at", since);
  if ((recent ?? 0) >= RATE_LIMIT.max) {
    return errorResponse("Muchas consultas seguidas. Esperá un momento y volvé a intentar.", 429);
  }

  // Conversación: la existente (verificando dueño) o una nueva.
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data: conv } = await supabase
      .from("alberdi_conversations")
      .select("id, student_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv || conv.student_id !== ctx.user.id) {
      return errorResponse("No encontramos esa conversación.", 404);
    }
  } else {
    const { data: created, error } = await supabase
      .from("alberdi_conversations")
      .insert({
        student_id: ctx.user.id,
        course_id: courseId,
        class_id: classId ?? null,
        title: message.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[alberdi] crear conversación", error);
      return errorResponse("No pudimos abrir la consulta. Probá de nuevo.", 500);
    }
    conversationId = created.id;
  }

  const [{ data: history }, context] = await Promise.all([
    supabase
      .from("alberdi_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS * 2),
    buildAlberdiContext(supabase, courseId, classId ?? null),
  ]);

  let focusClass: string | null = null;
  if (classId) {
    const { data: cls } = await supabase.from("classes").select("topic").eq("id", classId).maybeSingle();
    focusClass = cls?.topic ?? null;
  }

  const { error: userMsgError } = await supabase.from("alberdi_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });
  if (userMsgError) {
    console.error("[alberdi] guardar consulta", userMsgError);
    return errorResponse("No pudimos guardar tu consulta.", 500);
  }

  const priorTurns = (history ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const messages = [
    {
      role: "system" as const,
      content: buildSystemPrompt({ context: context.text, studentName: ctx.profile.full_name, focusClass }),
    },
    ...priorTurns.map((t) => ({
      role: t.role,
      content: t.role === "user" ? wrapUserMessage(t.content) : t.content,
    })),
    { role: "user" as const, content: wrapUserMessage(message) },
  ];

  type ChunkLike = { choices?: { delta?: { content?: string | null } }[] };
  let stream: AsyncIterable<ChunkLike>;
  try {
    const created = await openrouter.chat.completions.create({
      model: MODELS.fast,
      messages,
      temperature: 0.3,
      max_tokens: 1200,
      stream: true,
    });
    stream = created as unknown as AsyncIterable<ChunkLike>;
  } catch (err) {
    console.error("[alberdi] openrouter", err);
    return errorResponse("Alberdi no está disponible en este momento. Probá de nuevo en un minuto.", 502);
  }

  const encoder = new TextEncoder();
  const convId = conversationId;
  // `sources` va a una columna jsonb: las interfaces de TS no son asignables a
  // `Json` sin index signature, así que serializamos en el borde.
  const sources = JSON.parse(JSON.stringify(context.sources.slice(0, 40))) as Json;

  const body_ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      // Buffereamos el arranque para poder detectar (y ocultar) el marcador de
      // fuera-de-alcance antes de mandarle el primer caracter al estudiante.
      let head = "";
      let decided = false;
      let refused = false;

      const flush = (chunk: string) => {
        if (chunk) controller.enqueue(encoder.encode(chunk));
      };

      try {
        for await (const part of stream) {
          const delta = part.choices?.[0]?.delta?.content;
          if (!delta) continue;
          full += delta;

          if (!decided) {
            head += delta;
            if (head.trimStart().length < OUT_OF_SCOPE_MARKER.length) continue;
            decided = true;
            const trimmed = head.trimStart();
            if (trimmed.startsWith(OUT_OF_SCOPE_MARKER)) {
              refused = true;
              flush(trimmed.slice(OUT_OF_SCOPE_MARKER.length).trimStart());
            } else {
              flush(head);
            }
            continue;
          }
          flush(delta);
        }
        // Respuesta más corta que el marcador: decidimos al cierre.
        if (!decided) {
          const trimmed = head.trimStart();
          if (trimmed.startsWith(OUT_OF_SCOPE_MARKER)) {
            refused = true;
            flush(trimmed.slice(OUT_OF_SCOPE_MARKER.length).trimStart());
          } else {
            flush(head);
          }
        }
      } catch (err) {
        console.error("[alberdi] stream", err);
        flush("\n\n_Se cortó la respuesta. Probá preguntar de nuevo._");
      } finally {
        const clean = refused
          ? full.trimStart().slice(OUT_OF_SCOPE_MARKER.length).trimStart()
          : full;
        const { error } = await admin.from("alberdi_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: clean || "(sin respuesta)",
          refused,
          model: MODELS.fast,
          sources,
        });
        if (error) console.error("[alberdi] guardar respuesta", error);
        await admin.from("alberdi_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        controller.close();
      }
    },
  });

  return new Response(body_, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": convId,
    },
  });
}

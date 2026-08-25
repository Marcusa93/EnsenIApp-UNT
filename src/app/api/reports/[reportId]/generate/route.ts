import { NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatText, LLMError } from "@/lib/ai/llm";
import { MODELS } from "@/lib/openrouter";
import { collectReportDataset } from "@/lib/reports/collect";
import { buildReportUserPrompt, REPORT_SYSTEM_PROMPT } from "@/lib/reports/prompts";
import { isReportScope, parseReportFilters } from "@/lib/reports/types";
import { isTeacherOfCourse } from "@/lib/reports/access";
import { errorMessage } from "@/lib/utils";

export const maxDuration = 300;

const paramsSchema = z.object({ reportId: z.guid() });

/**
 * POST /api/reports/[reportId]/generate
 * pending|error|ready → processing → ready (result_md) | error (result_md con el mensaje).
 * Idempotente: si ya está en processing hace menos de 5 minutos, responde 409.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  const { reportId } = parsed.data;

  const auth = await getOptionalUser();
  if (!auth) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (auth.profile.role === "estudiante") {
    return NextResponse.json({ error: "Sólo el equipo docente puede generar informes." }, { status: 403 });
  }

  // Lectura con RLS: sólo el solicitante (o admin) ve el pedido.
  const supabase = await createClient();
  const { data: report, error } = await supabase.from("report_requests").select("*").eq("id", reportId).maybeSingle();
  if (error) {
    console.error("[reports/generate] lectura", { reportId, error });
    return NextResponse.json({ error: "No se pudo leer el pedido de informe." }, { status: 500 });
  }
  if (!report) return NextResponse.json({ error: "El informe no existe o no es tuyo." }, { status: 404 });
  if (!report.course_id) return NextResponse.json({ error: "El informe no tiene curso asociado." }, { status: 422 });
  if (!isReportScope(report.scope)) {
    return NextResponse.json({ error: `Tipo de informe desconocido: ${report.scope}` }, { status: 422 });
  }

  const allowed = await isTeacherOfCourse(auth.user.id, auth.profile.role, report.course_id);
  if (!allowed) return NextResponse.json({ error: "No sos docente de este curso." }, { status: 403 });

  if (report.status === "processing") {
    const startedAt = new Date(report.completed_at ?? report.created_at).getTime();
    if (Date.now() - startedAt < 5 * 60 * 1000) {
      return NextResponse.json({ status: "processing", error: "El informe ya se está generando." }, { status: 409 });
    }
  }

  const admin = createAdminClient();
  // Claim atómico (compare-and-set sobre el estado leído): dos POST concurrentes no pueden
  // generar el informe dos veces — el perdedor no matchea status/completed_at y recibe 409.
  // completed_at marca el inicio del procesamiento (se sobreescribe al terminar).
  const claimQuery = admin
    .from("report_requests")
    .update({ status: "processing", result_md: null, completed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", report.status);
  const guardedClaim = report.completed_at
    ? claimQuery.eq("completed_at", report.completed_at)
    : claimQuery.is("completed_at", null);
  const { data: claimed, error: startErr } = await guardedClaim.select("id").maybeSingle();
  if (startErr) {
    console.error("[reports/generate] no se pudo marcar processing", { reportId, startErr });
    return NextResponse.json({ error: "No se pudo iniciar la generación." }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ status: "processing", error: "El informe ya se está generando en otro pedido." }, { status: 409 });
  }

  try {
    const dataset = await collectReportDataset({
      scope: report.scope,
      courseId: report.course_id,
      filters: parseReportFilters(report.filters),
      requestedBy: { id: auth.user.id, role: auth.profile.role },
    });

    const result = await chatText({
      system: REPORT_SYSTEM_PROMPT,
      user: buildReportUserPrompt(dataset),
      model: MODELS.reasoning,
      temperature: 0.3,
      maxTokens: 3500,
    });

    const { error: doneErr } = await admin
      .from("report_requests")
      .update({ status: "ready", result_md: result.data.trim(), completed_at: new Date().toISOString() })
      .eq("id", reportId);
    if (doneErr) throw new Error(`No se pudo guardar el informe: ${doneErr.message}`);

    return NextResponse.json({ status: "ready", model: result.model, usage: result.usage });
  } catch (err) {
    const message =
      err instanceof LLMError
        ? err.message
        : errorMessage(err, "Falló la generación del informe. Probá de nuevo en unos minutos.");
    console.error("[reports/generate] error", { reportId, scope: report.scope, err });
    await admin
      .from("report_requests")
      .update({ status: "error", result_md: message, completed_at: new Date().toISOString() })
      .eq("id", reportId);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

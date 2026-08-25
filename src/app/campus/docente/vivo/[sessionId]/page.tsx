import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSessionForControl } from "@/lib/live/data";
import { requireTeacherOfClass } from "@/components/docente/teacher-guard";
import { getBaseUrl } from "@/lib/request-origin";
import { PageHeader } from "@/components/ui";
import { ControlRoom } from "./_components/control-room";

export const metadata: Metadata = { title: "Sesión en vivo · EnsenIA UNT" };

export default async function LiveControlRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireRole("docente", "admin");
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();

  const supabase = await createClient();
  const result = await getSessionForControl(supabase, sessionId);
  if (!result) notFound();

  // La RLS de live_sessions expone lectura pública de sesiones live/ended; acá
  // sólo debe entrar el docente dueño de la clase, así que lo re-verificamos.
  try {
    await requireTeacherOfClass(result.session.class_id);
  } catch {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const joinUrl = `${baseUrl}/vivo/${result.session.code}`;
  const projectorUrl = `${baseUrl}/vivo/${result.session.code}/proyector`;

  return (
    <>
      <PageHeader
        top={
          <Link
            href={`/campus/docente/clases/${result.session.class_id}/vivo`}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> {result.session.class_topic ?? "Sesión en vivo"}
          </Link>
        }
        eyebrow="Sala de control"
        title={`Sesión ${result.session.code}`}
      />

      <ControlRoom session={result.session} prompts={result.prompts} joinUrl={joinUrl} projectorUrl={projectorUrl} />
    </>
  );
}

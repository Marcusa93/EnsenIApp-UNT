import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLivePrompts, getLiveSessions } from "@/lib/live/data";
import { PageHeader } from "@/components/ui";
import { Reveal } from "@/components/shell";
import { PromptBank } from "./_components/prompt-bank";
import { SessionsPanel } from "./_components/sessions-panel";

export const metadata: Metadata = { title: "Sesión en vivo · EnsenIA UNT" };

export default async function LiveClassPage({ params }: { params: Promise<{ classId: string }> }) {
  await requireRole("docente", "admin");
  const { classId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(classId)) notFound();

  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("id, topic").eq("id", classId).maybeSingle();
  if (!cls) notFound();

  const [prompts, sessions] = await Promise.all([getLivePrompts(supabase, classId), getLiveSessions(supabase, classId)]);

  return (
    <>
      <PageHeader
        top={
          <Link
            href={`/campus/docente/clases/${classId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> {cls.topic}
          </Link>
        }
        eyebrow="Sesión en vivo"
        title="Actividades en clase"
        description="Un link único, cualquiera con nombre y apellido entra, y vos activás cada pregunta cuando llegás a ese momento."
      />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Reveal inView={false}>
          <PromptBank classId={classId} prompts={prompts} />
        </Reveal>
        <Reveal inView={false} delay={0.05}>
          <SessionsPanel classId={classId} sessions={sessions} hasPrompts={prompts.length > 0} />
        </Reveal>
      </div>
    </>
  );
}

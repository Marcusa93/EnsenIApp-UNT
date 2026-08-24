import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DebateView } from "@/components/debates/debate-view";
import { canModerateCourse, getDebateArguments, getDebateDetail } from "../_lib/data";

interface PageProps {
  params: Promise<{ debateId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { debateId } = await params;
  if (!UUID_RE.test(debateId)) return { title: "Debate · EnsenIA UNT" };
  const supabase = await createClient();
  const { data } = await supabase.from("debates").select("title").eq("id", debateId).maybeSingle();
  return { title: data ? `${data.title} · Debates · EnsenIA UNT` : "Debate · EnsenIA UNT" };
}

export default async function DebatePage({ params }: PageProps) {
  const { debateId } = await params;
  if (!UUID_RE.test(debateId)) notFound();

  const { user, profile } = await requireUser(`/campus/debates/${debateId}`);
  const supabase = await createClient();

  const debate = await getDebateDetail(supabase, debateId);
  if (!debate) notFound();

  const [args, canModerate] = await Promise.all([
    getDebateArguments(supabase, debateId, user.id),
    canModerateCourse(supabase, user.id, profile.role, debate.course_id),
  ]);

  return <DebateView debate={debate} initialArguments={args} currentUserId={user.id} canModerate={canModerate} />;
}

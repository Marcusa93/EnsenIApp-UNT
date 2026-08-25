import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveLiveRoom, hasResponded } from "@/lib/live/data";
import { normalizeLiveCode } from "@/lib/live/code";
import { Brand } from "@/components/shell/brand";
import { LiveRoom } from "./room";

export const metadata: Metadata = { title: "Sesión en vivo · EnsenIA UNT" };

export default async function LiveJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeLiveCode(rawCode);

  const ctx = await getOptionalUser();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/vivo/${code}`)}`);

  const supabase = await createClient();
  const room = await resolveLiveRoom(supabase, code);

  const submittedWord = room?.activePrompt ? await hasResponded(supabase, room.activePrompt.id, ctx.user.id) : null;

  return (
    <main className="campus-grid campus-grid-fade relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent-2) 55%, transparent), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative z-10 mb-8">
        <Brand />
      </div>

      {room ? (
        <LiveRoom initial={room} userId={ctx.user.id} fullName={ctx.profile.full_name} initialSubmittedWord={submittedWord} />
      ) : (
        <div className="border-gradient relative z-10 w-full max-w-md rounded-3xl border border-transparent bg-surface p-7 text-center sm:p-9">
          <p className="eyebrow">Sesión en vivo</p>
          <h1 className="mt-2 text-xl font-semibold">No encontramos esta sesión</h1>
          <p className="mt-2 text-sm text-muted">
            El código <span className="font-mono text-foreground">{code}</span> no es válido, o la sesión todavía no
            arrancó. Revisá el link con el equipo docente.
          </p>
        </div>
      )}
    </main>
  );
}

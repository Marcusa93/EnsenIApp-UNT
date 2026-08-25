import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getWordCounts, resolveLiveRoom } from "@/lib/live/data";
import { normalizeLiveCode } from "@/lib/live/code";
import { ProjectorRoom } from "./projector-room";

export const metadata: Metadata = { title: "Proyector · EnsenIA UNT" };

/**
 * Vista de pantalla grande: no exige sesión (RLS ya permite lectura pública
 * de sesiones vivas/finalizadas y de la nube agregada, sin exponer identidad).
 */
export default async function ProjectorPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeLiveCode(rawCode);

  const supabase = await createClient();
  const room = await resolveLiveRoom(supabase, code);

  if (!room) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#06070f] text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-accent-2">Sesión en vivo</p>
        <p className="mt-3 text-2xl font-semibold">No encontramos el código {code}</p>
      </main>
    );
  }

  const initialWords = room.activePrompt ? await getWordCounts(supabase, room.activePrompt.id) : [];

  return <ProjectorRoom initial={room} initialWords={initialWords} />;
}

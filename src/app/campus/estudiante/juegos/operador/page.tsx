import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { getAvatarData } from "@/lib/games/avatar-data";
import { Loadout } from "@/components/avatar/loadout";
import { levelFor } from "@/lib/games/config";

export const metadata: Metadata = { title: "Mi operador · EnsenIA UNT" };

export default async function OperadorPage() {
  const { user } = await requireRole("estudiante");
  const supabase = await createClient();
  const { avatar, items } = await getAvatarData(supabase, user.id);

  // Sin operador creado, el lugar donde se crea es la pantalla de Juegos.
  if (!avatar) redirect("/campus/estudiante/juegos");

  // Progreso real: define qué emotes ya se ganaron.
  const { data: stats } = await supabase
    .from("student_game_stats")
    .select("xp, best_streak, correct, runs")
    .eq("student_id", user.id)
    .maybeSingle();

  const progress = {
    level: levelFor(stats?.xp ?? 0).level.n,
    streak: stats?.best_streak ?? 0,
    correct: stats?.correct ?? 0,
    runs: stats?.runs ?? 0,
  };

  return (
    <>
      <PageHeader
        top={
          <Link
            href="/campus/estudiante/juegos"
            className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Juegos
          </Link>
        }
        eyebrow="El Expediente"
        title="Mi operador"
        description="Todo lo que ves acá se gana jugando. Lo bloqueado muestra qué falta para conseguirlo."
      />
      <Loadout avatar={avatar} items={items} progress={progress} />
    </>
  );
}

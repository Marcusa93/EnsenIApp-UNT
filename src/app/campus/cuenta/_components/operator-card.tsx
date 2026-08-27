import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { OperatorAvatar } from "@/components/avatar/operator-avatar";
import { getAvatarData } from "@/lib/games/avatar-data";
import { levelFor } from "@/lib/games/config";

/**
 * El operador en la configuración de la cuenta: es donde el estudiante espera
 * encontrar "su" identidad del campus, así que el avatar tiene que estar acá.
 */
export async function OperatorCard({ studentId }: { studentId: string }) {
  const supabase = await createClient();
  const { avatar, items } = await getAvatarData(supabase, studentId);

  if (!avatar) {
    return (
      <Card>
        <CardTitle eyebrow="El Expediente" as="h2" className="flex items-center gap-2">
          <Gamepad2 className="size-4 text-accent-2" aria-hidden />
          Tu operador
        </CardTitle>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Todavía no creaste el tuyo. Se arma la primera vez que entrás a Juegos, y se va equipando con lo que ganás
          repasando la materia.
        </p>
        <div className="mt-4">
          <Button asChild size="sm">
            <Link href="/campus/estudiante/juegos">Crear mi operador</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const { data: stats } = await supabase
    .from("student_game_stats")
    .select("xp")
    .eq("student_id", studentId)
    .maybeSingle();

  const progress = levelFor(stats?.xp ?? 0);
  const owned = items.filter((i) => i.unlocked).length;

  return (
    <Card>
      <CardTitle eyebrow="El Expediente" as="h2" className="flex items-center gap-2">
        <Gamepad2 className="size-4 text-accent-2" aria-hidden />
        Tu operador
      </CardTitle>

      <div className="mt-4 flex items-center gap-4">
        <OperatorAvatar config={avatar} size={96} title={avatar.callsign} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm uppercase tracking-[0.16em]">{avatar.callsign}</p>
          <p className="mt-1 text-sm text-muted">
            Nivel {progress.level.n} · {progress.level.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge size="sm" tone="muted">
              {stats?.xp ?? 0} XP
            </Badge>
            <Badge size="sm" tone="accent-2">
              {owned}/{items.length} equipos
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button asChild variant="secondary" size="sm">
          <Link href="/campus/estudiante/juegos/operador">Ver y cambiar el equipo</Link>
        </Button>
      </div>
    </Card>
  );
}

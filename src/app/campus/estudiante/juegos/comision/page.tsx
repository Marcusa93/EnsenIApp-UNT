import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flame, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCourse } from "@/lib/courses";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { Reveal } from "@/components/shell/reveal";
import { OperatorAvatar } from "@/components/avatar/operator-avatar";
import { levelFor } from "@/lib/games/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "La comisión · EnsenIA UNT" };

interface Row {
  student_id: string;
  nombre: string;
  xp: number;
  streak_days: number;
  runs: number;
  callsign: string | null;
  chassis: string | null;
  tone: string | null;
  glow: string | null;
  build: string | null;
  equipped: Record<string, string> | null;
}

/** Los tres primeros van al podio, con el del medio más alto. */
const PODIO = [
  { pos: 1, size: 150, order: "order-2", pad: "pb-10", medal: "🥇" },
  { pos: 2, size: 118, order: "order-1", pad: "pb-2", medal: "🥈" },
  { pos: 3, size: 118, order: "order-3", pad: "pb-2", medal: "🥉" },
] as const;

export default async function ComisionPage() {
  const { user, profile } = await requireRole("estudiante");
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="El Expediente" title="La comisión" />
        <EmptyState icon={Users} title="Todavía no estás en ninguna comisión" description="" />
      </>
    );
  }

  const { data } = await supabase.rpc("game_leaderboard", { p_course: course.id, p_limit: 100 });
  const rows = (data ?? []) as Row[];

  const cfg = (r: Row) => ({
    chassis: r.chassis ?? "redondo",
    tone: r.tone ?? "acero",
    glow: r.glow ?? "violeta",
    build: r.build ?? "estandar",
    equipped: r.equipped ?? {},
  });

  const podio = rows.slice(0, 3);
  const resto = rows.slice(3);

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
        title="La comisión"
        description="Los operadores de tus compañeros, con el equipo que se ganaron. Sólo aparecen quienes ya jugaron, y se los ve por su alias."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no jugó nadie"
          description="Cuando alguien juegue su primera partida, su operador aparece acá. Si arrancás vos, encabezás la sala."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Podio */}
          <Reveal>
            <Card className="overflow-hidden">
              <div className="flex items-end justify-center gap-3 sm:gap-6">
                {PODIO.map((slot) => {
                  const r = podio[slot.pos - 1];
                  if (!r) return null;
                  const isMe = r.student_id === user.id;
                  const lvl = levelFor(r.xp);
                  return (
                    <div key={r.student_id} className={cn("flex flex-col items-center", slot.order, slot.pad)}>
                      <span className="mb-1 text-xl" aria-hidden>
                        {slot.medal}
                      </span>
                      <OperatorAvatar
                        config={cfg(r)}
                        size={slot.size}
                        title={r.callsign ?? r.nombre}
                        className={cn("h-auto", isMe && "ring-2 ring-accent rounded-full")}
                      />
                      <p
                        className={cn(
                          "mt-2 max-w-[130px] truncate text-center font-mono text-[11px] uppercase tracking-widest",
                          isMe ? "text-accent" : "text-foreground",
                        )}
                      >
                        {isMe ? "Vos" : (r.callsign ?? r.nombre)}
                      </p>
                      <p className="text-center text-[11px] text-muted">{lvl.level.name}</p>
                      <p className="font-mono text-xs tabular-nums text-muted">{r.xp} XP</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Reveal>

          {/* El resto de la comisión */}
          {resto.length > 0 && (
            <Reveal delay={0.08}>
              <Card>
                <p className="eyebrow mb-3">Resto de la sala</p>
                <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {resto.map((r, i) => {
                    const isMe = r.student_id === user.id;
                    const lvl = levelFor(r.xp);
                    return (
                      <li
                        key={r.student_id}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                          isMe ? "border-accent/45 bg-accent/10" : "border-border bg-surface-2/40",
                        )}
                      >
                        <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted">{i + 4}</span>
                        <OperatorAvatar config={cfg(r)} size={44} bust className="shrink-0" title={r.callsign ?? r.nombre} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{isMe ? "Vos" : (r.callsign ?? r.nombre)}</p>
                          <p className="truncate text-[11px] text-muted">{lvl.level.name}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs tabular-nums">{r.xp} XP</p>
                          {r.streak_days > 1 && (
                            <p className="flex items-center justify-end gap-0.5 text-[10px] text-warning">
                              <Flame className="size-2.5" aria-hidden />
                              {r.streak_days}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </Reveal>
          )}

          <p className="text-center text-[11px] text-muted">
            {rows.length} {rows.length === 1 ? "operador en la sala" : "operadores en la sala"} ·{" "}
            <Badge size="sm" tone="muted">
              se muestra el alias, no el nombre completo
            </Badge>
          </p>
        </div>
      )}
    </>
  );
}

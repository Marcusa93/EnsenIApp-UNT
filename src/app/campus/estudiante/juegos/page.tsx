import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Gamepad2, GraduationCap, Shirt, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryCourse } from "@/lib/courses";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, Progress } from "@/components/ui";
import { Reveal } from "@/components/shell/reveal";
import { GAMES, levelFor, type GameKey } from "@/lib/games/config";
import { getAvatarData } from "@/lib/games/avatar-data";
import { OperatorAvatar } from "@/components/avatar/operator-avatar";
import { GameLauncher } from "./_components/game-launcher";
import { OperatorGate } from "./_components/operator-gate";

export const metadata: Metadata = { title: "Juegos · EnsenIA UNT" };

export default async function JuegosPage() {
  const { user, profile } = await requireRole("estudiante");
  const supabase = await createClient();
  const course = await getPrimaryCourse(supabase, user.id, profile.role);

  if (!course) {
    return (
      <>
        <PageHeader eyebrow="El Expediente" title="Juegos de la materia" />
        <EmptyState
          icon={GraduationCap}
          title="Todavía no estás en ninguna comisión"
          description="Cuando el equipo docente te agregue vas a poder jugar con el material de las clases."
          action={
            <Button asChild variant="secondary">
              <Link href="/campus/estudiante">Volver a Hoy</Link>
            </Button>
          }
        />
      </>
    );
  }

  const avatarData = await getAvatarData(supabase, user.id);

  // El operador se crea acá, no al entrar al campus: quien viene a buscar la
  // clase de mañana no se topa con nada; quien viene a jugar, lo arma.
  if (!avatarData.avatar) {
    return <OperatorGate />;
  }

  const [statsRes, configRes, classesRes, boardRes, countsRes] = await Promise.all([
    supabase
      .from("student_game_stats")
      .select("xp, runs, correct, answered, streak_days, best_streak")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle(),
    supabase.from("course_games").select("game, enabled").eq("course_id", course.id),
    supabase
      .from("classes")
      .select("id, topic, class_date")
      .eq("course_id", course.id)
      .order("class_date", { ascending: false }),
    supabase.rpc("game_leaderboard", { p_course: course.id, p_limit: 5 }),
    supabase.from("game_runs").select("game").eq("student_id", user.id).eq("course_id", course.id),
  ]);

  const stats = statsRes.data;
  const xp = stats?.xp ?? 0;
  const progress = levelFor(xp);
  const streak = stats?.streak_days ?? 0;
  const accuracy = stats?.answered ? Math.round((stats.correct / stats.answered) * 100) : null;

  // Sin filas de configuración se asume todo habilitado (comisión recién creada).
  const configRows = configRes.data ?? [];
  const disabled = new Set(configRows.filter((r) => !r.enabled).map((r) => r.game as GameKey));
  const available = GAMES.filter((g) => !disabled.has(g.key));

  const classes = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    topic: c.topic,
    date: c.class_date,
  }));

  const board = (boardRes.data ?? []) as {
    student_id: string;
    nombre: string;
    xp: number;
    streak_days: number;
    callsign: string | null;
    chassis: string | null;
    tone: string | null;
    glow: string | null;
    equipped: Record<string, string> | null;
  }[];
  const runsByGame = new Map<string, number>();
  for (const r of countsRes.data ?? []) {
    runsByGame.set(r.game, (runsByGame.get(r.game) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            El Expediente
            {streak > 1 && (
              <Badge size="sm" tone="warning" dot live>
                <Flame className="size-3" aria-hidden /> {streak} días seguidos
              </Badge>
            )}
          </span>
        }
        title="Jugá con la materia"
        description="Partidas de dos minutos hechas con lo que se dijo en clase. Cada acierto suma experiencia y te acerca al próximo escalón de la carrera."
      />

      {available.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="Los juegos están desactivados"
          description="El equipo docente los tiene apagados para esta comisión por ahora."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
            {/* Nivel */}
            <Reveal>
              <Card highlight>
                <div className="flex items-center gap-4">
                  <Link href="/campus/estudiante/juegos/operador" className="shrink-0" aria-label="Ver mi operador">
                    <OperatorAvatar
                      config={avatarData.avatar}
                      size={84}
                      title={avatarData.avatar.callsign}
                      className="transition hover:scale-105"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                      {avatarData.avatar.callsign}
                    </p>
                    <p className="eyebrow mt-1 text-accent-2">Nivel {progress.level.n}</p>
                    <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                      {progress.level.name}
                    </h2>
                  </div>
                  <p className="shrink-0 font-mono text-sm tabular-nums text-muted">
                    <span className="text-lg font-semibold text-foreground">{xp}</span> XP
                  </p>
                </div>

                <div className="mt-4">
                  <Progress value={Math.round(progress.ratio * 100)} />
                  <p className="mt-2 text-xs text-muted">
                    {progress.next
                      ? `Te faltan ${progress.xpForNext} XP para ${progress.next.name}.`
                      : "Llegaste al último escalón. Sos parte de la doctrina de la cátedra."}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button asChild variant="secondary" size="sm" leftIcon={<Shirt />}>
                    <Link href="/campus/estudiante/juegos/operador">
                      Mi operador
                      {avatarData.nuevos.length > 0 && ` · ${avatarData.nuevos.length} nuevo${avatarData.nuevos.length > 1 ? "s" : ""}`}
                    </Link>
                  </Button>
                  {avatarData.nuevos.length > 0 && (
                    <Badge size="sm" tone="accent-3" dot live>
                      Equipo desbloqueado
                    </Badge>
                  )}
                </div>

                {stats && stats.runs > 0 && (
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted">
                    {stats.runs} {stats.runs === 1 ? "partida" : "partidas"}
                    {accuracy != null && ` · ${accuracy}% de aciertos`}
                    {stats.best_streak > 1 && ` · mejor racha: ${stats.best_streak} días`}
                  </p>
                )}
              </Card>
            </Reveal>

            {/* Juegos */}
            <GameLauncher games={available} classes={classes} runsByGame={Object.fromEntries(runsByGame)} />
          </div>

          {/* Tabla de posiciones */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-4">
            <Reveal delay={0.1}>
              <Card>
                <CardTitle eyebrow="La comisión" as="h2" className="flex items-center gap-2">
                  <Trophy className="size-4 text-accent-3" aria-hidden />
                  Tabla de posiciones
                </CardTitle>

                {board.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    Nadie jugó todavía. Si arrancás vos, quedás primero.
                  </p>
                ) : (
                  <ol className="mt-3 flex flex-col gap-2">
                    {board.map((row, i) => {
                      const isMe = row.student_id === user.id;
                      return (
                        <li
                          key={row.student_id}
                          className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                            isMe ? "border-accent/40 bg-accent/10" : "border-border bg-surface-2/50"
                          }`}
                        >
                          <span className="w-4 shrink-0 font-mono text-xs tabular-nums text-muted">{i + 1}</span>
                          {row.chassis && row.tone && row.glow ? (
                            <OperatorAvatar
                              config={{
                                chassis: row.chassis,
                                tone: row.tone,
                                glow: row.glow,
                                equipped: row.equipped ?? {},
                              }}
                              size={32}
                              bust
                              className="shrink-0"
                              title={row.callsign ?? row.nombre}
                            />
                          ) : (
                            <span className="size-8 shrink-0 rounded-full border border-border bg-surface-2" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {isMe ? "Vos" : (row.callsign ?? row.nombre)}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{row.xp} XP</span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  Sólo se muestra el nombre de pila de quienes ya jugaron.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>
      )}
    </>
  );
}

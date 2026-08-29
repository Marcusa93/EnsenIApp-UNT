-- 021: Retos — competencia asincrónica entre estudiantes de la misma comisión.
--
-- La idea: además de jugar solo contra el reloj, un estudiante puede retar a un
-- compañero puntual (elegido por alias, nunca por nombre real) a la misma tanda
-- de preguntas de una clase. Cada uno juega cuando puede — no hace falta que
-- estén online a la vez — y se compara puntaje (después duración, como
-- desempate). El resultado paga en el MISMO sistema de puntos que ya existe:
-- cada partida entra a game_runs como una partida más (racha, tabla de
-- posiciones y nivel se actualizan solos por el trigger de siempre), y quien
-- gana el reto recibe un bonus de XP extra, acreditado con el mismo truco que
-- ya usa el desafío semanal (una fila de game_runs sin preguntas).
--
-- Nunca se filtra correct_index al cliente: el reto elige challenge_ids en el
-- servidor con el mismo Fisher-Yates que /api/games/play, y ambos lados se
-- corrigen re-consultando game_challenges por id, igual que /api/games/finish.

create table game_duels (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  game game_key not null,
  challenger_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid not null references profiles(id) on delete cascade,
  /** Set congelado al crear el reto: los dos juegan exactamente las mismas preguntas. */
  challenge_ids uuid[] not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'completado', 'rechazado')),
  challenger_run_id uuid references game_runs(id) on delete set null,
  challenger_correct int,
  challenger_total int,
  challenger_duration_seconds int,
  opponent_run_id uuid references game_runs(id) on delete set null,
  opponent_correct int,
  opponent_total int,
  opponent_duration_seconds int,
  /** null = todavía no completado, o empate. */
  winner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  check (challenger_id <> opponent_id)
);

create index game_duels_challenger_idx on game_duels (challenger_id, created_at desc);
create index game_duels_opponent_idx on game_duels (opponent_id, created_at desc);
-- Evita spamear el mismo reto mientras uno ya está pendiente.
create unique index game_duels_no_dup_pending on game_duels (challenger_id, opponent_id, class_id, game)
  where status = 'pendiente';

alter table game_duels enable row level security;

create policy "game_duels: participantes leen" on game_duels
  for select using (challenger_id = auth.uid() or opponent_id = auth.uid());
create policy "game_duels: docente lee" on game_duels
  for select using (auth_is_teacher_of(course_id) or auth_role() = 'admin');
-- Insert/update sólo por el servidor (service role): crear el reto, corregirlo
-- y cerrarlo pasa siempre por /api/duels/*, nunca por escritura directa del cliente.

-- ---------------------------------------------------------------------------
-- Roster de la comisión para elegir rival: sólo alias, nunca nombre real.
-- Mismo patrón que v_game_tables (020) y v_live_wordcloud (006): la vista NO
-- es security_invoker, corre con privilegio propio y repite el chequeo de
-- pertenencia a mano.
-- ---------------------------------------------------------------------------

create view v_classmates as
select e.course_id, e.student_id, coalesce(sa.callsign, 'Operador') as callsign
from enrollments e
left join student_avatars sa on sa.student_id = e.student_id
where e.status = 'active'
  and (auth_is_enrolled(e.course_id) or auth_is_teacher_of(e.course_id) or auth_role() = 'admin');

grant select on v_classmates to authenticated;

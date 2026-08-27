-- 014: "El Expediente" — juegos de la materia.
--
-- La idea: que repasar la clase sea algo que se pueda JUGAR en dos minutos desde
-- el celular, y que esa práctica acumule XP y suba de nivel siguiendo la carrera
-- judicial (Ingresante → ... → Jurista). Los desafíos no se escriben a mano: se
-- generan con IA desde el material real de cada grabación (transcripción con
-- minutos, resumen y glosario), así el juego siempre habla de LO QUE SE DIJO en
-- clase y no de contenido genérico.
--
-- Tres juegos, cada uno explota algo que el campus ya tiene:
--   duelo    → opción múltiple sobre los conceptos de la clase.
--   momento  → "¿en qué minuto se dijo esto?" (usa la transcripción minutada).
--   glosario → emparejar término y definición (usa el glosario ya generado).
--
-- El equipo docente prende y apaga cada juego por comisión (course_games).

create type game_key as enum ('duelo', 'momento', 'glosario');

-- ---------------------------------------------------------------------------
-- Configuración por comisión
-- ---------------------------------------------------------------------------

create table course_games (
  course_id uuid not null references courses(id) on delete cascade,
  game game_key not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (course_id, game)
);

alter table course_games enable row level security;

create policy "course_games: la comisión lo lee" on course_games
  for select using (auth_is_enrolled(course_id) or auth_is_teacher_of(course_id) or auth_role() = 'admin');
create policy "course_games: docente configura" on course_games
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Banco de desafíos (generado por IA desde las grabaciones)
-- ---------------------------------------------------------------------------

create table game_challenges (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  recording_id uuid references class_recordings(id) on delete cascade,
  game game_key not null,
  /** El enunciado: la pregunta, o la frase textual en "momento". */
  prompt text not null,
  /** Opciones a elegir. En "momento" son marcas de tiempo en texto ("12:30"). */
  options jsonb not null default '[]',
  correct_index int not null,
  /** Por qué esa es la respuesta: se muestra después de contestar. */
  explanation text,
  /** Cita textual de la clase que respalda la respuesta (anti-invento). */
  source_quote text,
  /** Segundo exacto donde aparece en la grabación, para poder ir a escucharlo. */
  source_seconds numeric,
  difficulty int not null default 1 check (difficulty between 1 and 3),
  created_at timestamptz not null default now()
);
create index game_challenges_pick_idx on game_challenges (course_id, game, class_id);

alter table game_challenges enable row level security;

-- Ojo: el estudiante NO lee esta tabla (tiene la respuesta correcta adentro).
-- Las partidas se arman en el servidor y se corrigen ahí; el cliente nunca ve
-- correct_index antes de contestar.
create policy "game_challenges: docente cura" on game_challenges
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Partidas y progresión
-- ---------------------------------------------------------------------------

create table game_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  game game_key not null,
  correct int not null default 0,
  total int not null default 0,
  xp int not null default 0,
  duration_seconds int,
  created_at timestamptz not null default now()
);
create index game_runs_student_idx on game_runs (student_id, created_at desc);
create index game_runs_course_idx on game_runs (course_id, created_at desc);

alter table game_runs enable row level security;

create policy "game_runs: propias" on game_runs
  for select using (student_id = auth.uid());
create policy "game_runs: docente lee" on game_runs
  for select using (auth_is_teacher_of(course_id) or auth_role() = 'admin');
-- El insert lo hace el servidor (service role) al corregir la partida.

create table student_game_stats (
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  xp int not null default 0,
  runs int not null default 0,
  correct int not null default 0,
  answered int not null default 0,
  /** Días seguidos jugando: el motor de hábito del juego. */
  streak_days int not null default 0,
  best_streak int not null default 0,
  last_played_on date,
  updated_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

alter table student_game_stats enable row level security;

create policy "student_game_stats: propias" on student_game_stats
  for select using (student_id = auth.uid());
create policy "student_game_stats: docente lee" on student_game_stats
  for select using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Acumulación de XP y racha: en trigger, para que sea atómico con la partida
-- ---------------------------------------------------------------------------

create or replace function fn_apply_game_run()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_today date := (new.created_at at time zone 'America/Argentina/Tucuman')::date;
  v_last date;
  v_streak int;
begin
  select last_played_on, streak_days into v_last, v_streak
    from student_game_stats
    where student_id = new.student_id and course_id = new.course_id;

  -- Racha: +1 si jugó ayer, se mantiene si ya jugó hoy, y vuelve a 1 si cortó.
  if v_last is null then
    v_streak := 1;
  elsif v_last = v_today then
    v_streak := coalesce(v_streak, 1);
  elsif v_last = v_today - 1 then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  insert into student_game_stats as s
    (student_id, course_id, xp, runs, correct, answered, streak_days, best_streak, last_played_on, updated_at)
  values
    (new.student_id, new.course_id, new.xp, 1, new.correct, new.total, v_streak, v_streak, v_today, now())
  on conflict (student_id, course_id) do update set
    xp = s.xp + excluded.xp,
    runs = s.runs + 1,
    correct = s.correct + excluded.correct,
    answered = s.answered + excluded.answered,
    streak_days = excluded.streak_days,
    best_streak = greatest(s.best_streak, excluded.streak_days),
    last_played_on = excluded.last_played_on,
    updated_at = now();

  return new;
end;
$$;

create trigger trg_apply_game_run after insert on game_runs
  for each row execute function fn_apply_game_run();

-- Las medallas se re-evalúan solas: fn_award_on_activity() saca el student_id
-- por jsonb, así que sirve tal cual para esta tabla nueva.
create trigger trg_badges_game after insert on game_runs
  for each row execute function fn_award_on_activity();

-- ---------------------------------------------------------------------------
-- Tabla de posiciones de la comisión
-- ---------------------------------------------------------------------------

-- security definer + chequeo de pertenencia: deja ver el ranking de TU comisión
-- sin abrir profiles de otros. Devuelve sólo el nombre de pila.
create or replace function game_leaderboard(p_course uuid, p_limit int default 10)
returns table (student_id uuid, nombre text, xp int, streak_days int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (auth_is_enrolled(p_course) or auth_is_teacher_of(p_course) or auth_role() = 'admin') then
    return;
  end if;

  return query
    select s.student_id,
           split_part(p.full_name, ' ', 1) as nombre,
           s.xp,
           s.streak_days
      from student_game_stats s
      join profiles p on p.id = s.student_id
     where s.course_id = p_course and s.xp > 0
     order by s.xp desc, s.updated_at asc
     limit greatest(1, least(p_limit, 50));
end;
$$;

-- ---------------------------------------------------------------------------
-- Medallas propias del juego
-- ---------------------------------------------------------------------------

insert into badges (id, name, description, icon, tier, sort) values
  ('primer-duelo',   'Primera audiencia',    'Jugaste tu primer desafío de la materia.',               '🎲', 'bronce', 13),
  ('oido-fino',      'Oído fino',            'Acertaste 10 veces en qué momento se dijo algo.',        '🎧', 'plata',  14),
  ('racha-juez',     'Constancia de juez',   'Jugaste 5 días seguidos.',                               '⚖️', 'oro',    15)
on conflict (id) do nothing;

-- Se suman a award_badges() sin reescribirla entera: la reemplazamos agregando
-- los tres criterios nuevos al final del insert.
create or replace function award_badges(p_student uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_events int;
  v_event_types int;
  v_days int;
  v_checkins int;
  v_alberdi int;
  v_escaladas int;
  v_vivo int;
  v_entregas int;
  v_argumentos int;
  v_placas int;
  v_medallas int;
  v_juegos int;
  v_momento_ok int;
  v_racha int;
begin
  select count(*), count(distinct event_type), count(distinct (created_at at time zone 'America/Argentina/Tucuman')::date)
    into v_events, v_event_types, v_days
    from usage_events where student_id = p_student;
  select count(*) into v_checkins from student_checkins where student_id = p_student;
  select count(*) into v_alberdi
    from alberdi_messages m join alberdi_conversations c on c.id = m.conversation_id
    where c.student_id = p_student and m.role = 'user';
  select count(*) into v_escaladas from student_questions where student_id = p_student;
  select count(*) into v_vivo from live_responses where participant_id = p_student;
  select count(*) into v_entregas from activity_submissions
    where student_id = p_student and status in ('entregada', 'corregida');
  select count(*) into v_argumentos from debate_arguments where author_id = p_student;
  select count(*) into v_placas from card_progress where student_id = p_student and known;

  select count(*) into v_juegos from game_runs where student_id = p_student;
  select coalesce(sum(correct), 0) into v_momento_ok
    from game_runs where student_id = p_student and game = 'momento';
  select coalesce(max(best_streak), 0) into v_racha
    from student_game_stats where student_id = p_student;

  insert into student_badges (student_id, badge_id)
  select p_student, b.id from badges b
  where (b.id = 'bienvenida'       and v_events >= 1)
     or (b.id = 'explorador'       and v_event_types >= 4)
     or (b.id = 'voz-del-aula'     and v_checkins >= 1)
     or (b.id = 'curioso-juridico' and v_alberdi >= 3)
     or (b.id = 'aura-ciberdelito' and v_vivo >= 1)
     or (b.id = 'mano-alzada'      and v_escaladas >= 1)
     or (b.id = 'entrega-perfecta' and v_entregas >= 1)
     or (b.id = 'pico-de-oro'      and v_argumentos >= 1)
     or (b.id = 'racha-encendida'  and v_days >= 3)
     or (b.id = 'crack-nuevas-tec' and v_placas >= 15)
     or (b.id = 'presencia-total'  and v_days >= 8)
     or (b.id = 'primer-duelo'     and v_juegos >= 1)
     or (b.id = 'oido-fino'        and v_momento_ok >= 10)
     or (b.id = 'racha-juez'       and v_racha >= 5)
  on conflict do nothing;

  select count(*) into v_medallas from student_badges where student_id = p_student;
  if v_medallas >= 7 then
    insert into student_badges (student_id, badge_id)
    values (p_student, 'leyenda-catedra')
    on conflict do nothing;
  end if;
end;
$$;

-- Los juegos arrancan habilitados en las comisiones que ya existen.
insert into course_games (course_id, game)
select c.id, g.game from courses c cross join (select unnest(enum_range(null::game_key)) as game) g
on conflict do nothing;

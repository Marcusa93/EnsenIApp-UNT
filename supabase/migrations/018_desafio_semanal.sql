-- 018: el desafío de la semana.
--
-- Una meta que se renueva todos los lunes: juntar cierta cantidad de aciertos
-- durante la semana. Es el motor de hábito más fuerte que tiene el juego —una
-- razón para volver el miércoles y no sólo la noche antes del parcial— y encaja
-- con el ritmo real de una cursada.
--
-- No hace falta una tabla de desafíos: cuál es la meta se deduce de la semana
-- (misma para toda la comisión), y el avance se cuenta desde game_runs. Lo único
-- que hay que registrar es QUIÉN ya cobró la recompensa de cada semana, para que
-- no se cobre dos veces.

create table weekly_claims (
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  /** Lunes de la semana, en hora de Tucumán. */
  week_start date not null,
  correct int not null,
  xp_awarded int not null,
  claimed_at timestamptz not null default now(),
  primary key (student_id, course_id, week_start)
);
create index weekly_claims_student_idx on weekly_claims (student_id, week_start desc);

alter table weekly_claims enable row level security;

create policy "weekly_claims: propios" on weekly_claims
  for select using (student_id = auth.uid());
create policy "weekly_claims: docente lee" on weekly_claims
  for select using (auth_is_teacher_of(course_id) or auth_role() = 'admin');
-- El alta la hace el servidor con service role, después de verificar la meta.

-- ---------------------------------------------------------------------------
-- Equipo exclusivo del desafío semanal
-- ---------------------------------------------------------------------------

-- Se gana por CANTIDAD DE SEMANAS completadas, que es otra cosa que el XP: premia
-- la constancia sostenida en el tiempo y no el atracón de una tarde.
-- (el valor 'semanas' del enum avatar_req se agrega aparte: Postgres no permite
--  usar un valor de enum nuevo en la misma transacción en que se lo agrega)

insert into avatar_items (id, name, description, slot, rarity, req_kind, req_value, req_badge, sort) values
  ('visor-constante', 'Visor del Constante', 'Una semana entera cumpliendo la meta. Se nota en la mirada.',            'visor', 'raro',       'semanas', 1, null, 8),
  ('aura-semanal',    'Ritmo Sostenido',     'Cuatro semanas de meta cumplida. La constancia se volvió visible.',      'aura',  'epico',      'semanas', 4, null, 47),
  ('comp-metronomo',  'Metrónomo',           'Ocho semanas. Marca tu ritmo de estudio y no falla.',                    'companion', 'epico',  'semanas', 8, null, 36),
  ('toga-temporada',  'Toga de Temporada',   'Doce semanas cumplidas. Prácticamente la cursada entera.',               'toga',  'legendario', 'semanas', 12, null, 17)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- El desbloqueo ahora también mira las semanas cumplidas
-- ---------------------------------------------------------------------------

create or replace function unlock_avatar_items(p_student uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_xp int;
  v_racha int;
  v_aciertos int;
  v_partidas int;
  v_nivel int;
  v_semanas int;
begin
  if not exists (select 1 from student_avatars where student_id = p_student) then
    return;
  end if;

  select coalesce(max(xp), 0), coalesce(max(best_streak), 0),
         coalesce(sum(correct), 0), coalesce(sum(runs), 0)
    into v_xp, v_racha, v_aciertos, v_partidas
    from student_game_stats where student_id = p_student;

  select count(*) into v_semanas from weekly_claims where student_id = p_student;

  -- Umbrales espejo de LEVELS en src/lib/games/config.ts.
  v_nivel := case
    when v_xp >= 7500 then 12 when v_xp >= 5800 then 11 when v_xp >= 4300 then 10
    when v_xp >= 3200 then 9  when v_xp >= 2300 then 8  when v_xp >= 1600 then 7
    when v_xp >= 1100 then 6  when v_xp >= 700  then 5  when v_xp >= 400  then 4
    when v_xp >= 200  then 3  when v_xp >= 80   then 2  else 1 end;

  insert into student_avatar_items (student_id, item_id)
  select p_student, i.id
    from avatar_items i
   where (i.req_kind = 'inicio')
      or (i.req_kind = 'nivel'     and v_nivel    >= i.req_value)
      or (i.req_kind = 'racha'     and v_racha    >= i.req_value)
      or (i.req_kind = 'aciertos'  and v_aciertos >= i.req_value)
      or (i.req_kind = 'partidas'  and v_partidas >= i.req_value)
      or (i.req_kind = 'semanas'   and v_semanas  >= i.req_value)
      or (i.req_kind = 'medalla'   and i.req_badge is not null
          and exists (select 1 from student_badges sb
                       where sb.student_id = p_student and sb.badge_id = i.req_badge))
  on conflict do nothing;
end;
$$;

-- Cobrar la recompensa semanal también puede abrir equipo nuevo.
create or replace function fn_unlock_on_weekly()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform unlock_avatar_items(new.student_id);
  return new;
end;
$$;

create trigger trg_unlock_avatar_weekly after insert on weekly_claims
  for each row execute function fn_unlock_on_weekly();

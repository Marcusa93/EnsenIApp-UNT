-- 019: la sala de la comisión.
--
-- Ver a los compañeros con su equipo puesto es el motor social del juego: que
-- alguien tenga una toga que vos no tenés dice más que cualquier número.
--
-- Se rehace game_leaderboard para que devuelva también la complexión (que se
-- agregó después) y se acepte un límite más alto, así la misma función sirve
-- para el podio de la pantalla de Juegos y para la sala completa.

drop function if exists game_leaderboard(uuid, int);

create or replace function game_leaderboard(p_course uuid, p_limit int default 10)
returns table (
  student_id uuid,
  nombre text,
  xp int,
  streak_days int,
  runs int,
  callsign text,
  chassis text,
  tone text,
  glow text,
  build text,
  equipped jsonb
)
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
           s.streak_days,
           s.runs,
           a.callsign,
           a.chassis,
           a.tone,
           a.glow,
           a.build,
           a.equipped
      from student_game_stats s
      join profiles p on p.id = s.student_id
      left join student_avatars a on a.student_id = s.student_id
     where s.course_id = p_course and s.xp > 0
     order by s.xp desc, s.updated_at asc
     limit greatest(1, least(p_limit, 200));
end;
$$;

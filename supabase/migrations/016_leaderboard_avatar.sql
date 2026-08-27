-- 016: la tabla de posiciones muestra el operador.
--
-- Ver el avatar del compañero al lado del puntaje es lo que convierte una lista
-- de nombres en un ranking de juego. Se agregan las columnas del avatar al
-- resultado (hay que DROP + CREATE: Postgres no deja cambiar el tipo de retorno).
-- El left join mantiene en la tabla a quien jugó antes de crear su operador.

drop function if exists game_leaderboard(uuid, int);

create or replace function game_leaderboard(p_course uuid, p_limit int default 10)
returns table (
  student_id uuid,
  nombre text,
  xp int,
  streak_days int,
  callsign text,
  chassis text,
  tone text,
  glow text,
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
           a.callsign,
           a.chassis,
           a.tone,
           a.glow,
           a.equipped
      from student_game_stats s
      join profiles p on p.id = s.student_id
      left join student_avatars a on a.student_id = s.student_id
     where s.course_id = p_course and s.xp > 0
     order by s.xp desc, s.updated_at asc
     limit greatest(1, least(p_limit, 50));
end;
$$;

-- 012: hotfix del trigger de medallas.
-- PL/pgSQL valida los campos de TODAS las ramas del CASE aunque no se ejecuten:
-- `new.participant_id` no existe en usage_events y rompía cada insert con
-- trigger (telemetría, check-ins, etc.). Se extrae el campo vía to_jsonb(new),
-- que devuelve null si la clave no está, sin error de plan.

create or replace function fn_award_on_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_student uuid;
  v_row jsonb := to_jsonb(new);
begin
  v_student := coalesce(
    (v_row->>'student_id')::uuid,
    (v_row->>'participant_id')::uuid,
    (v_row->>'author_id')::uuid
  );
  if v_student is not null then
    perform award_badges(v_student);
  end if;
  return new;
end;
$$;

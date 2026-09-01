-- 028: las alertas se resuelven solas cuando la causa desaparece.
--
-- El sistema detectaba solo (inactividad, consulta sin responder) pero
-- resolver era siempre un clic manual del docente — incluso cuando la propia
-- plataforma ya sabía que el problema no existía más: el estudiante volvió, la
-- consulta se respondió. Alerta que el sistema abre por su cuenta, el sistema
-- la cierra por su cuenta; el "Resolver" manual queda para el criterio humano
-- (bajo desempeño, dificultad reiterada), donde resolver significa "me ocupé".

-- Volvió a entrar al campus → la alerta de inactividad ya no dice nada.
create or replace function fn_resolver_inactividad()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update teacher_alerts
     set resolved = true
   where student_id = new.student_id
     and kind = 'inactividad'
     and not resolved;
  return new;
end;
$$;

create trigger trg_resolver_inactividad after insert on usage_events
  for each row execute function fn_resolver_inactividad();

-- La consulta se respondió (docente o chat) → la alerta de consulta sin
-- responder ya está atendida.
create or replace function fn_resolver_consulta_alerta()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('respondida_docente', 'cerrada') and old.status is distinct from new.status then
    update teacher_alerts
       set resolved = true
     where student_id = new.student_id
       and course_id = new.course_id
       and kind = 'consulta_sin_responder'
       and not resolved;
  end if;
  return new;
end;
$$;

create trigger trg_resolver_consulta_alerta after update on student_questions
  for each row execute function fn_resolver_consulta_alerta();

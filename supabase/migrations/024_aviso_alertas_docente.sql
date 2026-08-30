-- 024: las alertas de estudiantes en riesgo también tocan la campana.
--
-- `teacher_alerts` ya se llenaba sola por trigger (inactividad, bajo desempeño,
-- dificultad reiterada, consulta sin responder), pero vivía en un panel al que
-- había que entrar. Acá cada alerta nueva le aparece al equipo docente de esa
-- comisión en la campana del campus.
--
-- El aviso se arma en SQL porque quien crea la alerta es un trigger, no la app:
-- por eso llega a la campana pero no dispara push (el push vive en Node, con la
-- clave VAPID). Para lo que es —una señal de seguimiento, no una urgencia— con
-- la campana alcanza.

create or replace function fn_avisar_alerta_docente()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, kind, title, body, url, course_id)
  select ta.teacher_id,
         'alerta_docente'::notification_kind,
         'Alerta de seguimiento',
         new.message,
         '/campus/docente',
         new.course_id
    from teacher_assignments ta
   where ta.course_id = new.course_id;
  return new;
end;
$$;

create trigger trg_avisar_alerta_docente after insert on teacher_alerts
  for each row execute function fn_avisar_alerta_docente();

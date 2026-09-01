-- 027: responder por chat también responde la consulta.
--
-- El trigger de 022 reabría la consulta cuando el estudiante repreguntaba, pero
-- no cerraba el circuito inverso: si el docente contestaba SÓLO por el chat
-- (sin redactar la respuesta destacada), la consulta quedaba "abierta" para
-- siempre en su panel de pendientes. Ahora el mensaje del docente la marca
-- respondida, igual que la respuesta formal.

create or replace function fn_touch_question_thread()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update student_questions
     set last_message_at = new.created_at,
         last_author_role = new.author_role,
         status = case
           -- El estudiante repregunta sobre algo respondido: vuelve a pendiente.
           when new.author_role = 'estudiante' and status in ('respondida_ia', 'respondida_docente')
             then 'abierta'::question_status
           -- La cátedra responde por chat: deja de estar pendiente.
           when new.author_role in ('docente', 'admin') and status in ('abierta', 'respondida_ia')
             then 'respondida_docente'::question_status
           else status
         end
   where id = new.question_id;
  return new;
end;
$$;

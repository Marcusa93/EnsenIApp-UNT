-- 022: las consultas pasan a ser una conversación con historial.
--
-- Hasta acá `student_questions` era de un solo turno: el estudiante preguntaba,
-- el docente (o la IA) respondía una vez y ahí moría. Si el estudiante no
-- entendía la respuesta, tenía que abrir otra consulta desde cero, y el docente
-- perdía el hilo de qué se venía hablando.
--
-- Ahora la consulta es el encabezado del hilo (la pregunta original, la
-- respuesta de la IA y la primera del docente siguen donde estaban, así no se
-- rompe nada de lo ya cargado) y las réplicas se acumulan en question_messages.
-- Los dos lados pueden seguir escribiendo, y queda el historial completo.

create table question_messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references student_questions(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  /** Con qué rol escribió, congelado: si mañana cambia de rol, el hilo se sigue leyendo igual. */
  author_role user_role not null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index question_messages_thread_idx on question_messages (question_id, created_at);

alter table question_messages enable row level security;

-- Quién puede leer el hilo: el dueño de la consulta y el equipo docente de esa
-- comisión. A diferencia del select de student_questions, acá NO se abre por
-- `is_public`: una consulta puede publicarse para la comisión, pero la
-- conversación de ida y vuelta es entre el estudiante y su docente.
create policy "question_messages: dueño o docente del curso" on question_messages
  for select using (
    exists (
      select 1 from student_questions q
      where q.id = question_messages.question_id
        and (q.student_id = auth.uid() or auth_is_teacher_of(q.course_id) or auth_role() = 'admin')
    )
  );

-- Escribe el mismo conjunto, y siempre en nombre propio: author_id tiene que
-- ser quien manda el mensaje, así nadie escribe haciéndose pasar por otro.
create policy "question_messages: responde el dueño o el docente" on question_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from student_questions q
      where q.id = question_messages.question_id
        and (q.student_id = auth.uid() or auth_is_teacher_of(q.course_id) or auth_role() = 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Actividad del hilo: para ordenar por lo que se movió y saber de quién es el turno
-- ---------------------------------------------------------------------------

alter table student_questions
  add column last_message_at timestamptz,
  add column last_author_role user_role;

/**
 * Mantiene al día el encabezado del hilo. Además reabre la consulta cuando el
 * estudiante vuelve a escribir sobre algo ya respondido: si repregunta, para el
 * docente vuelve a estar pendiente.
 */
create or replace function fn_touch_question_thread()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update student_questions
     set last_message_at = new.created_at,
         last_author_role = new.author_role,
         status = case
           when new.author_role = 'estudiante' and status in ('respondida_ia', 'respondida_docente')
             then 'abierta'::question_status
           else status
         end
   where id = new.question_id;
  return new;
end;
$$;

create trigger trg_touch_question_thread after insert on question_messages
  for each row execute function fn_touch_question_thread();

-- 009: Alberdi — asistente de consulta acotado al material de la materia.
--
-- Es un chat multi-turno (a diferencia de `student_questions`, que es una
-- consulta puntual que además puede responder el docente). Alberdi responde
-- SÓLO con lo que el equipo docente cargó: cronograma, resúmenes de clases
-- grabadas, versiones simplificadas, transcripciones y materiales. Fuera de
-- ese alcance, declina — el guardrail vive en el system prompt y en el
-- contexto (no se le pasa nada que no sea de la materia).

create table alberdi_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  -- Opcional: ancla la conversación a una clase concreta ("preguntar sobre esta clase").
  class_id uuid references classes(id) on delete set null,
  title text not null default 'Consulta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index alberdi_conversations_student_idx on alberdi_conversations (student_id, updated_at desc);

create type alberdi_role as enum ('user', 'assistant');

create table alberdi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references alberdi_conversations(id) on delete cascade,
  role alberdi_role not null,
  content text not null,
  /** true cuando Alberdi declinó por estar fuera del alcance de la materia. */
  refused boolean not null default false,
  model text,
  /** Clases/recursos que se usaron como contexto, para poder auditar la respuesta. */
  sources jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index alberdi_messages_conversation_idx on alberdi_messages (conversation_id, created_at);

create trigger trg_alberdi_conversations_updated
  before update on alberdi_conversations
  for each row execute function set_updated_at();

alter table alberdi_conversations enable row level security;
alter table alberdi_messages enable row level security;

-- El estudiante maneja sus propias conversaciones.
create policy "alberdi_conversations: own" on alberdi_conversations
  for all using (student_id = auth.uid()) with check (student_id = auth.uid() and auth_is_enrolled(course_id));

-- El docente del curso puede leerlas: las consultas son la señal más directa
-- de qué le cuesta al curso. Se le avisa al estudiante en la UI.
create policy "alberdi_conversations: teacher of course reads" on alberdi_conversations
  for select using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "alberdi_messages: own" on alberdi_messages
  for all using (
    exists (select 1 from alberdi_conversations c where c.id = alberdi_messages.conversation_id and c.student_id = auth.uid())
  ) with check (
    exists (select 1 from alberdi_conversations c where c.id = alberdi_messages.conversation_id and c.student_id = auth.uid())
  );

create policy "alberdi_messages: teacher of course reads" on alberdi_messages
  for select using (
    exists (
      select 1 from alberdi_conversations c
      where c.id = alberdi_messages.conversation_id
        and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

-- Vista agregada para el panel/informes del docente: volumen de consultas y
-- cuántas quedaron fuera de alcance, sin exponer el detalle en el listado.
create or replace view v_alberdi_stats
with (security_invoker = true) as
select
  c.course_id,
  count(distinct c.id) as conversations,
  count(m.id) filter (where m.role = 'user') as questions,
  count(m.id) filter (where m.refused) as refused,
  count(distinct c.student_id) as students,
  max(m.created_at) as last_at
from alberdi_conversations c
left join alberdi_messages m on m.conversation_id = c.id
group by c.course_id;

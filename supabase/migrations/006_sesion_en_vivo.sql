-- 006: Sesión en vivo — micro-actividades en clase (nube de palabras) activadas
-- por el docente en tiempo real, con acceso abierto por link/código (sin
-- requerir inscripción formal), respuestas identificadas por el usuario logueado
-- (incluye sesiones anónimas por nombre — ver 005).

create type live_prompt_type as enum ('nube');
create type live_session_status as enum ('draft', 'live', 'ended');

-- Banco de preguntas reutilizable por clase (el docente las arma antes,
-- las va activando una por una durante la sesión en vivo).
create table live_prompts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  type live_prompt_type not null default 'nube',
  question text not null,
  display_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index live_prompts_class_idx on live_prompts (class_id, display_order);

-- Una sesión en vivo concreta (una vez que se dicta la clase). `active_prompt_id`
-- es la única fuente de verdad de "qué está activo ahora": cambiarla es lo que
-- el docente hace al tocar "activar", y es lo que Realtime empuja a todos los
-- que tienen el link abierto.
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  code text not null unique,
  status live_session_status not null default 'draft',
  active_prompt_id uuid references live_prompts(id) on delete set null,
  created_by uuid not null references profiles(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index live_sessions_class_idx on live_sessions (class_id, created_at desc);

-- Respuestas. Una por participante y prompt (RLS además exige que el prompt
-- sea justo el que está activo en ese momento: no se puede responder tarde).
create table live_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  prompt_id uuid not null references live_prompts(id) on delete cascade,
  participant_id uuid not null references profiles(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 60),
  normalized_word text not null,
  created_at timestamptz not null default now(),
  unique (prompt_id, participant_id)
);
create index live_responses_prompt_idx on live_responses (prompt_id);

-- Vista agregada para el proyector: nunca expone quién dijo qué, sólo
-- palabra + frecuencia. Deliberadamente SIN security_invoker: corre con
-- privilegios del dueño (bypassa la RLS restrictiva de live_responses) para
-- que el proyector pueda mostrar el conteo en vivo sin ver identidades.
create view v_live_wordcloud as
select
  lr.session_id,
  lr.prompt_id,
  lr.normalized_word,
  min(lr.word) as display_word,
  count(*) as frequency
from live_responses lr
join live_sessions ls on ls.id = lr.session_id
where ls.status in ('live', 'ended')
group by lr.session_id, lr.prompt_id, lr.normalized_word;

grant select on v_live_wordcloud to authenticated, anon;

alter publication supabase_realtime add table live_sessions;
alter publication supabase_realtime add table live_responses;

alter table live_prompts enable row level security;
alter table live_sessions enable row level security;
alter table live_responses enable row level security;

-- live_prompts: el docente ve/administra todo el banco de su clase; un
-- participante sólo puede leer la pregunta que está activa en ESE momento
-- (para no revelarle las próximas disparadoras de la clase).
create policy "live_prompts: teacher manages own class" on live_prompts
  for all using (
    exists (select 1 from classes c where c.id = live_prompts.class_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  ) with check (
    exists (select 1 from classes c where c.id = live_prompts.class_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  );

create policy "live_prompts: visible while active in a live session" on live_prompts
  for select using (
    exists (select 1 from live_sessions ls where ls.active_prompt_id = live_prompts.id and ls.status = 'live')
  );

-- live_sessions: el docente administra las suyas; cualquier usuario logueado
-- (incluye acceso por nombre) puede leer una sesión en vivo o ya finalizada
-- por su código — así funciona el link público sin exigir inscripción.
create policy "live_sessions: teacher manages own class" on live_sessions
  for all using (
    exists (select 1 from classes c where c.id = live_sessions.class_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  ) with check (
    exists (select 1 from classes c where c.id = live_sessions.class_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  );

create policy "live_sessions: anyone reads live or ended by code" on live_sessions
  for select using (status in ('live', 'ended'));

-- live_responses: el participante inserta la suya sólo si coincide con el
-- prompt activo de una sesión en vivo; puede releer la propia (para saber que
-- ya respondió); el docente de la clase ve todo (por si quiere auditar).
create policy "live_responses: participant answers the active prompt" on live_responses
  for insert with check (
    participant_id = auth.uid()
    and exists (
      select 1 from live_sessions ls
      where ls.id = live_responses.session_id
        and ls.status = 'live'
        and ls.active_prompt_id = live_responses.prompt_id
    )
  );

create policy "live_responses: own or teacher" on live_responses
  for select using (
    participant_id = auth.uid()
    or exists (
      select 1 from live_sessions ls join classes c on c.id = ls.class_id
      where ls.id = live_responses.session_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: clase de Ciberdelitos (falta en el cronograma) + las 6 disparadoras.
-- ---------------------------------------------------------------------------
insert into classes (id, course_id, class_date, topic, summary, sort_order) values (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  current_date + interval '7 days',
  'Clase 3 · Ciberdelincuencia: "Sr. Juez, el robo no fue real, solo virtual"',
  'El Código Penal de 1921 exige una "cosa mueble ajena" para hablar de robo o hurto: ¿qué pasa entonces cuando lo que te sacan es dinero que sólo existe como registro en un servidor, o directamente datos? Recorremos la Ley 26.388 (2008) y sus piezas complementarias (grooming, Convenio de Budapest), la distinción entre delitos ciberdependientes y ciberasistidos, y casos argentinos recientes (deepfakes en Córdoba, la Operación Kaerb, Tree Nix, el ransomware al PAMI) para terminar discutiendo el proyecto de reforma que empieza a tratar a la identidad digital como un bien jurídico propio.',
  3
) on conflict (id) do nothing;

insert into live_prompts (class_id, type, question, display_order) values
  ('00000000-0000-0000-0000-000000000003', 'nube', 'Te vaciaron la cuenta con un link trucho. En una palabra: ¿qué te hicieron?', 1),
  ('00000000-0000-0000-0000-000000000003', 'nube', 'En una palabra: ¿qué le hicieron a esas chicas de Córdoba?', 2),
  ('00000000-0000-0000-0000-000000000003', 'nube', 'En una palabra: ¿quién es el delincuente en el caso Kaerb?', 3),
  ('00000000-0000-0000-0000-000000000003', 'nube', 'En una palabra: ¿qué te robaron si venden tus datos personales?', 4),
  ('00000000-0000-0000-0000-000000000003', 'nube', 'En una palabra: ¿cómo llamarías lo que le hicieron al PAMI?', 5),
  ('00000000-0000-0000-0000-000000000003', 'nube', 'En una palabra: ¿el robo virtual es real?', 6)
on conflict do nothing;

-- EnsenIA UNT — 002: núcleo del campus
-- Lógica docente (actividades, asignación, entregas, materiales), padrón,
-- consultas y encuestas a estudiantes, debates, alertas automáticas,
-- progreso de placas interactivas y pipeline de grabaciones enriquecido.

-- ---------------------------------------------------------------------------
-- Perfiles: estado de validación contra el padrón
-- ---------------------------------------------------------------------------
create type profile_status as enum ('pendiente', 'validado', 'bloqueado');

alter table profiles
  add column status profile_status not null default 'pendiente',
  add column dni text,
  add column last_seen_at timestamptz,
  add column onboarding_done boolean not null default false;

-- Padrón de alumnos (carga masiva por el docente/admin). Al registrarse,
-- si el email está en el padrón, el perfil queda 'validado' y se inscribe.
create table roster (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  email text not null,
  full_name text,
  dni text,
  matched_profile_id uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (course_id, email)
);
create index roster_email_idx on roster (lower(email));

-- Reemplaza el trigger de alta: valida contra padrón y auto-inscribe.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_status profile_status := 'pendiente';
begin
  insert into public.profiles (id, full_name, email, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'estudiante'),
    new.raw_user_meta_data->>'avatar_url'
  );

  for r in select * from public.roster where lower(email) = lower(new.email) loop
    v_status := 'validado';
    update public.roster set matched_profile_id = new.id where id = r.id;
    insert into public.enrollments (student_id, course_id)
    values (new.id, r.course_id)
    on conflict do nothing;
  end loop;

  update public.profiles set status = v_status where id = new.id;
  return new;
end;
$$;

-- Cuando se carga el padrón después del alta, vincula perfiles existentes.
create or replace function roster_match_existing()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  p record;
begin
  select * into p from public.profiles where lower(email) = lower(new.email) limit 1;
  if found then
    new.matched_profile_id := p.id;
    update public.profiles set status = 'validado' where id = p.id and status = 'pendiente';
    insert into public.enrollments (student_id, course_id)
    values (p.id, new.course_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_roster_insert
  before insert on roster
  for each row execute function roster_match_existing();

-- Cuerpo docente (presentación pública del equipo de cátedra)
create table faculty (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  full_name text not null,
  position text not null,
  rank int not null default 99,
  profile_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clases: materiales y grabaciones con progreso del pipeline
-- ---------------------------------------------------------------------------
create type material_kind as enum ('pdf', 'link', 'video', 'doc', 'otro');

create table class_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  kind material_kind not null default 'link',
  url text,
  storage_path text,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter type recording_status add value if not exists 'generating' after 'processing';

alter table class_recordings
  add column title text,
  add column mime_type text,
  add column size_bytes bigint,
  add column progress smallint not null default 0 check (progress between 0 and 100),
  add column current_step text,
  add column processing_log jsonb not null default '[]',
  add column published boolean not null default false;

alter table class_summaries
  add column glossary jsonb not null default '[]',
  add column sections jsonb not null default '[]';

-- ---------------------------------------------------------------------------
-- Lógica docente: actividades, asignación, entregas
-- ---------------------------------------------------------------------------
create type activity_type as enum ('lectura', 'cuestionario', 'placas', 'entrega', 'debate', 'encuesta');
create type activity_status as enum ('draft', 'published', 'closed');
create type activity_target as enum ('todos', 'seleccionados');

create table activities (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  recording_id uuid references class_recordings(id) on delete set null,
  created_by uuid not null references profiles(id),
  title text not null,
  instructions_md text,
  type activity_type not null default 'lectura',
  content jsonb not null default '{}',
  status activity_status not null default 'draft',
  target activity_target not null default 'todos',
  due_at timestamptz,
  published_at timestamptz,
  max_score numeric(5,2) default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_course_status_idx on activities (course_id, status);

create table activity_assignments (
  activity_id uuid not null references activities(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (activity_id, student_id)
);

create type submission_status as enum ('en_progreso', 'entregada', 'corregida', 'reabierta');

create table activity_submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '{}',
  auto_score numeric(5,2),
  score numeric(5,2),
  teacher_feedback_md text,
  ai_feedback_md text,
  status submission_status not null default 'en_progreso',
  time_spent_seconds int not null default 0,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references profiles(id),
  unique (activity_id, student_id)
);

-- ¿El estudiante puede ver esta actividad? (publicada + inscripto + destinatario)
create or replace function auth_can_see_activity(a_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from activities a
    where a.id = a_id
      and a.status <> 'draft'
      and auth_is_enrolled(a.course_id)
      and (
        a.target = 'todos'
        or exists (select 1 from activity_assignments aa where aa.activity_id = a.id and aa.student_id = auth.uid())
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Progreso en placas interactivas (repaso espaciado liviano)
-- ---------------------------------------------------------------------------
create table card_progress (
  student_id uuid not null references profiles(id) on delete cascade,
  recording_id uuid not null references class_recordings(id) on delete cascade,
  card_index int not null,
  known boolean not null default false,
  attempts int not null default 0,
  correct int not null default 0,
  last_seen_at timestamptz not null default now(),
  primary key (student_id, recording_id, card_index)
);

-- ---------------------------------------------------------------------------
-- Consultas de estudiantes (dudas) y encuestas rápidas del docente
-- ---------------------------------------------------------------------------
create type question_status as enum ('abierta', 'respondida_ia', 'respondida_docente', 'cerrada');

create table student_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  recording_id uuid references class_recordings(id) on delete set null,
  question text not null,
  ai_answer_md text,
  teacher_answer_md text,
  answered_by uuid references profiles(id),
  status question_status not null default 'abierta',
  is_anonymous boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index student_questions_course_idx on student_questions (course_id, created_at desc);

create type poll_status as enum ('draft', 'open', 'closed');

create table polls (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  created_by uuid not null references profiles(id),
  question text not null,
  options jsonb not null default '[]',
  allow_free_text boolean not null default false,
  status poll_status not null default 'draft',
  created_at timestamptz not null default now(),
  closes_at timestamptz
);

create table poll_responses (
  poll_id uuid not null references polls(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  option_index int,
  free_text text,
  created_at timestamptz not null default now(),
  primary key (poll_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Debates (modelo UrbanIA): posturas, hilos, apoyos y moderación
-- ---------------------------------------------------------------------------
create type debate_status as enum ('open', 'closed', 'archived');
create type debate_stance as enum ('a_favor', 'en_contra', 'neutral');
create type argument_status as enum ('visible', 'hidden');

create table debates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  recording_id uuid references class_recordings(id) on delete set null,
  created_by uuid not null references profiles(id),
  title text not null,
  context_md text,
  status debate_status not null default 'open',
  closes_at timestamptz,
  ai_synthesis_md text,
  created_at timestamptz not null default now()
);

create table debate_arguments (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references debates(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references debate_arguments(id) on delete cascade,
  stance debate_stance not null,
  content text not null check (char_length(content) between 1 and 4000),
  status argument_status not null default 'visible',
  hidden_by uuid references profiles(id),
  hidden_reason text,
  created_at timestamptz not null default now()
);
create index debate_arguments_debate_idx on debate_arguments (debate_id, created_at);

create table debate_supports (
  argument_id uuid not null references debate_arguments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (argument_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Alertas automáticas para el docente
-- ---------------------------------------------------------------------------
create type alert_kind as enum ('dificultad_reiterada', 'bajo_desempeno', 'inactividad', 'consulta_sin_responder');

create table teacher_alerts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  kind alert_kind not null,
  message text not null,
  metadata jsonb not null default '{}',
  resolved boolean not null default false,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index teacher_alerts_course_idx on teacher_alerts (course_id, resolved, created_at desc);

-- 2+ check-ins con dificultad >= 4 en 7 días -> alerta (dedupe 7 días)
create or replace function fn_alert_on_checkin()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_course uuid;
  v_count int;
begin
  select course_id into v_course from classes where id = new.class_id;
  select count(*) into v_count
  from student_checkins sc join classes c on c.id = sc.class_id
  where sc.student_id = new.student_id and c.course_id = v_course
    and sc.difficulty >= 4 and sc.created_at > now() - interval '7 days';

  if v_count >= 2 and not exists (
    select 1 from teacher_alerts
    where student_id = new.student_id and course_id = v_course
      and kind = 'dificultad_reiterada' and created_at > now() - interval '7 days'
  ) then
    insert into teacher_alerts (course_id, student_id, kind, message, metadata)
    values (v_course, new.student_id, 'dificultad_reiterada',
      'El estudiante reportó dificultad alta en varias clases esta semana.',
      jsonb_build_object('checkins_7d', v_count));
  end if;
  return new;
end;
$$;

create trigger trg_alert_on_checkin
  after insert on student_checkins
  for each row execute function fn_alert_on_checkin();

-- Entrega con puntaje <= 40% -> alerta
create or replace function fn_alert_on_submission()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_course uuid;
  v_max numeric;
  v_score numeric;
begin
  v_score := coalesce(new.score, new.auto_score);
  if v_score is null then return new; end if;
  select course_id, coalesce(max_score, 10) into v_course, v_max from activities where id = new.activity_id;
  if v_score <= v_max * 0.4 and not exists (
    select 1 from teacher_alerts
    where student_id = new.student_id and course_id = v_course and kind = 'bajo_desempeno'
      and (metadata->>'activity_id')::uuid = new.activity_id
  ) then
    insert into teacher_alerts (course_id, student_id, kind, message, metadata)
    values (v_course, new.student_id, 'bajo_desempeno',
      'Desempeño bajo en una actividad. Conviene hacer seguimiento.',
      jsonb_build_object('activity_id', new.activity_id, 'score', v_score, 'max', v_max));
  end if;
  return new;
end;
$$;

create trigger trg_alert_on_submission
  after insert or update of score, auto_score on activity_submissions
  for each row execute function fn_alert_on_submission();

-- updated_at genérico
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger trg_activities_updated
  before update on activities for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime: progreso del pipeline de grabación y alertas
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table class_recordings;
alter publication supabase_realtime add table teacher_alerts;
alter publication supabase_realtime add table debate_arguments;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table roster enable row level security;
alter table faculty enable row level security;
alter table class_materials enable row level security;
alter table activities enable row level security;
alter table activity_assignments enable row level security;
alter table activity_submissions enable row level security;
alter table card_progress enable row level security;
alter table student_questions enable row level security;
alter table polls enable row level security;
alter table poll_responses enable row level security;
alter table debates enable row level security;
alter table debate_arguments enable row level security;
alter table debate_supports enable row level security;
alter table teacher_alerts enable row level security;

-- Perfiles: docentes ven a los inscriptos de sus cursos (para listados/feedback)
create policy "profiles: teacher sees enrolled students" on profiles
  for select using (
    exists (
      select 1 from enrollments e
      where e.student_id = profiles.id and auth_is_teacher_of(e.course_id)
    )
  );
create policy "profiles: admin update" on profiles
  for update using (auth_role() = 'admin');

create policy "roster: teacher/admin" on roster
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "faculty: read all" on faculty for select using (true);
create policy "faculty: admin write" on faculty
  for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

create policy "materials: course members" on class_materials
  for select using (
    exists (select 1 from classes c where c.id = class_materials.class_id
      and (auth_is_enrolled(c.course_id) or auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  );
create policy "materials: teacher write" on class_materials
  for all using (
    exists (select 1 from classes c where c.id = class_materials.class_id
      and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  ) with check (
    exists (select 1 from classes c where c.id = class_materials.class_id
      and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  );

-- Recordings: el estudiante sólo ve grabaciones publicadas
drop policy "recordings: enrolled student, teacher, or admin" on class_recordings;
create policy "recordings: student sees published, teacher all" on class_recordings
  for select using (
    exists (
      select 1 from classes c where c.id = class_recordings.class_id
        and ((auth_is_enrolled(c.course_id) and class_recordings.published)
             or auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create policy "activities: student sees published+targeted, teacher all" on activities
  for select using (
    auth_is_teacher_of(course_id) or auth_role() = 'admin' or auth_can_see_activity(id)
  );
create policy "activities: teacher write" on activities
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "assignments: own or teacher" on activity_assignments
  for select using (
    student_id = auth.uid()
    or exists (select 1 from activities a where a.id = activity_assignments.activity_id
      and (auth_is_teacher_of(a.course_id) or auth_role() = 'admin'))
  );
create policy "assignments: teacher write" on activity_assignments
  for all using (
    exists (select 1 from activities a where a.id = activity_assignments.activity_id
      and (auth_is_teacher_of(a.course_id) or auth_role() = 'admin'))
  ) with check (
    exists (select 1 from activities a where a.id = activity_assignments.activity_id
      and (auth_is_teacher_of(a.course_id) or auth_role() = 'admin'))
  );

create policy "submissions: own or teacher" on activity_submissions
  for select using (
    student_id = auth.uid()
    or exists (select 1 from activities a where a.id = activity_submissions.activity_id
      and (auth_is_teacher_of(a.course_id) or auth_role() = 'admin'))
  );
create policy "submissions: student creates own" on activity_submissions
  for insert with check (student_id = auth.uid() and auth_can_see_activity(activity_id));
create policy "submissions: student updates own while open" on activity_submissions
  for update using (student_id = auth.uid() and status in ('en_progreso', 'reabierta'))
  with check (student_id = auth.uid());
create policy "submissions: teacher grades" on activity_submissions
  for update using (
    exists (select 1 from activities a where a.id = activity_submissions.activity_id
      and (auth_is_teacher_of(a.course_id) or auth_role() = 'admin'))
  );

create policy "card_progress: own" on card_progress
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "card_progress: teacher read" on card_progress
  for select using (
    exists (select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = card_progress.recording_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin'))
  );

create policy "questions: own, public in course, or teacher" on student_questions
  for select using (
    student_id = auth.uid()
    or (is_public and auth_is_enrolled(course_id))
    or auth_is_teacher_of(course_id) or auth_role() = 'admin'
  );
create policy "questions: student asks" on student_questions
  for insert with check (student_id = auth.uid() and auth_is_enrolled(course_id));
create policy "questions: teacher answers" on student_questions
  for update using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "polls: course members see open/closed, teacher all" on polls
  for select using (
    auth_is_teacher_of(course_id) or auth_role() = 'admin'
    or (auth_is_enrolled(course_id) and status <> 'draft')
  );
create policy "polls: teacher write" on polls
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "poll_responses: own or teacher" on poll_responses
  for select using (
    student_id = auth.uid()
    or exists (select 1 from polls p where p.id = poll_responses.poll_id
      and (auth_is_teacher_of(p.course_id) or auth_role() = 'admin'))
  );
create policy "poll_responses: student answers open poll" on poll_responses
  for insert with check (
    student_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_id and p.status = 'open' and auth_is_enrolled(p.course_id))
  );

create policy "debates: course members" on debates
  for select using (auth_is_enrolled(course_id) or auth_is_teacher_of(course_id) or auth_role() = 'admin');
create policy "debates: teacher write" on debates
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "arguments: visible to course members, hidden to teacher/author" on debate_arguments
  for select using (
    exists (select 1 from debates d where d.id = debate_arguments.debate_id
      and (
        (debate_arguments.status = 'visible' and (auth_is_enrolled(d.course_id) or auth_is_teacher_of(d.course_id)))
        or debate_arguments.author_id = auth.uid()
        or auth_is_teacher_of(d.course_id) or auth_role() = 'admin'
      ))
  );
create policy "arguments: members post while open" on debate_arguments
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from debates d where d.id = debate_id and d.status = 'open'
      and (d.closes_at is null or d.closes_at > now())
      and (auth_is_enrolled(d.course_id) or auth_is_teacher_of(d.course_id)))
  );
create policy "arguments: teacher moderates" on debate_arguments
  for update using (
    exists (select 1 from debates d where d.id = debate_arguments.debate_id
      and (auth_is_teacher_of(d.course_id) or auth_role() = 'admin'))
  );

create policy "supports: course members read" on debate_supports
  for select using (
    exists (select 1 from debate_arguments a join debates d on d.id = a.debate_id
      where a.id = debate_supports.argument_id
      and (auth_is_enrolled(d.course_id) or auth_is_teacher_of(d.course_id) or auth_role() = 'admin'))
  );
create policy "supports: own toggle" on debate_supports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "alerts: teacher of course" on teacher_alerts
  for select using (auth_is_teacher_of(course_id) or auth_role() = 'admin');
create policy "alerts: teacher resolves" on teacher_alerts
  for update using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

-- Report requests: el docente ve los propios, y puede actualizarlos (resultado)
create policy "report_requests: own update" on report_requests
  for update using (requested_by = auth.uid() or auth_role() = 'admin');

-- Announcements: sólo docentes del curso insertan (refuerzo del with check)
drop policy "announcements: teacher/admin write" on announcements;
create policy "announcements: teacher/admin write" on announcements
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin')
  with check (auth_is_teacher_of(course_id) or auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Storage: políticas para el bucket privado de grabaciones y materiales
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('class-materials', 'class-materials', false)
  on conflict (id) do nothing;

create policy "recordings bucket: teachers upload" on storage.objects
  for insert with check (
    bucket_id = 'class-recordings' and auth_role() in ('docente', 'admin')
  );
create policy "recordings bucket: members read" on storage.objects
  for select using (
    bucket_id = 'class-recordings' and auth.uid() is not null
  );
create policy "materials bucket: teachers upload" on storage.objects
  for insert with check (
    bucket_id = 'class-materials' and auth_role() in ('docente', 'admin')
  );
create policy "materials bucket: members read" on storage.objects
  for select using (
    bucket_id = 'class-materials' and auth.uid() is not null
  );

-- ---------------------------------------------------------------------------
-- Vistas de apoyo para informes y paneles
-- ---------------------------------------------------------------------------
create or replace view v_course_engagement
with (security_invoker = true) as
select
  c.id as course_id,
  count(distinct e.student_id) as enrolled,
  count(distinct ue.student_id) filter (where ue.created_at > now() - interval '7 days') as active_7d,
  count(distinct sq.id) as questions_total,
  count(distinct sq.id) filter (where sq.status = 'abierta') as questions_open,
  round(avg(sc.difficulty)::numeric, 2) as avg_difficulty
from courses c
left join enrollments e on e.course_id = c.id
left join usage_events ue on ue.student_id = e.student_id
left join student_questions sq on sq.course_id = c.id
left join classes cl on cl.course_id = c.id
left join student_checkins sc on sc.class_id = cl.id
group by c.id;

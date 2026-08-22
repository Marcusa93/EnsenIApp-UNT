-- EnsenIA UNT — esquema inicial
-- Roles, materias/cursos, cronograma, grabaciones de clase + IA (resúmenes,
-- placas interactivas, lenguaje simplificado, feedback), consultas a
-- estudiantes e informes a demanda.

create extension if not exists "pgcrypto";

create type user_role as enum ('estudiante', 'docente', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'estudiante',
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'estudiante')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Materias y cursos (comisiones/cohortes)
create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  term text not null,
  enrollment_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table teacher_assignments (
  teacher_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (teacher_id, course_id)
);

create table enrollments (
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create or replace function auth_is_teacher_of(target_course uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from teacher_assignments
    where teacher_id = auth.uid() and course_id = target_course
  );
$$;

create or replace function auth_is_enrolled(target_course uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from enrollments
    where student_id = auth.uid() and course_id = target_course
  );
$$;

-- Cronograma / clases
create table classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  teacher_id uuid references profiles(id),
  class_date date not null,
  topic text not null,
  summary text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  author_id uuid not null references profiles(id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Grabaciones de clase y pipeline de IA
create type recording_status as enum (
  'uploaded', 'transcribing', 'processing', 'ready', 'error'
);

create table class_recordings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  storage_path text not null,
  duration_seconds int,
  status recording_status not null default 'uploaded',
  error_message text,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null unique references class_recordings(id) on delete cascade,
  full_text text not null,
  segments jsonb not null default '[]',
  language text not null default 'es',
  model text,
  created_at timestamptz not null default now()
);

create table class_summaries (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references class_recordings(id) on delete cascade,
  summary_md text not null,
  key_points jsonb not null default '[]',
  model text,
  created_at timestamptz not null default now()
);

-- "Placas interactivas": tarjetas tipo flashcard/quiz generadas de la clase
create table interactive_cards (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references class_recordings(id) on delete cascade,
  cards jsonb not null default '[]',
  model text,
  created_at timestamptz not null default now()
);

create type simplification_level as enum ('facil', 'intermedio');

create table simplified_content (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references class_recordings(id) on delete cascade,
  level simplification_level not null,
  content_md text not null,
  model text,
  created_at timestamptz not null default now(),
  unique (recording_id, level)
);

-- Feedback personalizado generado a partir del uso del alumno
create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  recording_id uuid references class_recordings(id) on delete cascade,
  feedback_md text not null,
  model text,
  created_at timestamptz not null default now()
);

-- Consultas rápidas al estudiante ("qué te costó de esta clase")
create table student_checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  difficulty smallint not null check (difficulty between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Telemetría de uso (para informes y mejora continua del campus)
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index usage_events_student_idx on usage_events (student_id, created_at desc);

-- Informes a solicitud de parte (docente/admin pide un reporte de uso/consultas)
create type report_status as enum ('pending', 'processing', 'ready', 'error');

create table report_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles(id),
  course_id uuid references courses(id) on delete cascade,
  scope text not null,
  filters jsonb not null default '{}',
  status report_status not null default 'pending',
  result_md text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- RLS
alter table profiles enable row level security;
alter table subjects enable row level security;
alter table courses enable row level security;
alter table teacher_assignments enable row level security;
alter table enrollments enable row level security;
alter table classes enable row level security;
alter table announcements enable row level security;
alter table class_recordings enable row level security;
alter table transcripts enable row level security;
alter table class_summaries enable row level security;
alter table interactive_cards enable row level security;
alter table simplified_content enable row level security;
alter table ai_feedback enable row level security;
alter table student_checkins enable row level security;
alter table usage_events enable row level security;
alter table report_requests enable row level security;

create policy "profiles: self and same-course visibility" on profiles
  for select using (id = auth.uid() or auth_role() = 'admin');
create policy "profiles: self update" on profiles
  for update using (id = auth.uid());

create policy "subjects: read all authenticated" on subjects
  for select using (auth.uid() is not null);
create policy "subjects: admin write" on subjects
  for all using (auth_role() = 'admin');

create policy "courses: read all authenticated" on courses
  for select using (auth.uid() is not null);
create policy "courses: admin write" on courses
  for all using (auth_role() = 'admin');

create policy "teacher_assignments: read own or admin" on teacher_assignments
  for select using (teacher_id = auth.uid() or auth_role() = 'admin');
create policy "teacher_assignments: admin write" on teacher_assignments
  for all using (auth_role() = 'admin');

create policy "enrollments: read own, teacher of course, or admin" on enrollments
  for select using (
    student_id = auth.uid() or auth_is_teacher_of(course_id) or auth_role() = 'admin'
  );
create policy "enrollments: student self-enroll" on enrollments
  for insert with check (student_id = auth.uid());
create policy "enrollments: admin/teacher write" on enrollments
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "classes: enrolled student, teacher, or admin" on classes
  for select using (
    auth_is_enrolled(course_id) or auth_is_teacher_of(course_id) or auth_role() = 'admin'
  );
create policy "classes: teacher/admin write" on classes
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "announcements: enrolled student, teacher, or admin" on announcements
  for select using (
    auth_is_enrolled(course_id) or auth_is_teacher_of(course_id) or auth_role() = 'admin'
  );
create policy "announcements: teacher/admin write" on announcements
  for all using (auth_is_teacher_of(course_id) or auth_role() = 'admin');

create policy "recordings: enrolled student, teacher, or admin" on class_recordings
  for select using (
    exists (
      select 1 from classes c
      where c.id = class_recordings.class_id
        and (auth_is_enrolled(c.course_id) or auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );
create policy "recordings: teacher/admin write" on class_recordings
  for all using (
    exists (
      select 1 from classes c
      where c.id = class_recordings.class_id
        and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create policy "transcripts: same access as recording" on transcripts
  for select using (
    exists (
      select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = transcripts.recording_id
        and (auth_is_enrolled(c.course_id) or auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create policy "summaries: same access as recording" on class_summaries
  for select using (
    exists (
      select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = class_summaries.recording_id
        and (auth_is_enrolled(c.course_id) or auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create policy "cards: same access as recording" on interactive_cards
  for select using (
    exists (
      select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = interactive_cards.recording_id
        and (auth_is_enrolled(c.course_id) or auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create policy "simplified: same access as recording" on simplified_content
  for select using (
    exists (
      select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = simplified_content.recording_id
        and (auth_is_enrolled(c.course_id) or auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create policy "ai_feedback: own or teacher/admin" on ai_feedback
  for select using (student_id = auth.uid() or auth_role() in ('docente', 'admin'));

create policy "checkins: own or teacher/admin" on student_checkins
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from classes c
      where c.id = student_checkins.class_id
        and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );
create policy "checkins: student insert own" on student_checkins
  for insert with check (student_id = auth.uid());

create policy "usage_events: own or teacher/admin" on usage_events
  for select using (student_id = auth.uid() or auth_role() in ('docente', 'admin'));
create policy "usage_events: student insert own" on usage_events
  for insert with check (student_id = auth.uid());

create policy "report_requests: own or admin" on report_requests
  for select using (requested_by = auth.uid() or auth_role() = 'admin');
create policy "report_requests: teacher/admin insert" on report_requests
  for insert with check (auth_role() in ('docente', 'admin'));

-- EnsenIA UNT — 004: integración de la fase paralela
-- Consolida supabase/migrations/pending/{pipeline,actividades,docente-panel-clases,notificaciones}.sql
-- y agrega los ajustes cruzados acordados en los reportes de módulo
-- (delete de informes, realtime de apoyos de debate, unicidad de check-ins).

-- ==========================================================================
-- 1. Pipeline de grabaciones
-- ==========================================================================

-- Una sola fila de resumen / placas por grabación (el pipeline hace
-- delete+insert; con la constraint puede pasar a upsert on conflict).
delete from class_summaries a using class_summaries b
  where a.recording_id = b.recording_id and a.ctid < b.ctid;
delete from interactive_cards a using interactive_cards b
  where a.recording_id = b.recording_id and a.ctid < b.ctid;
create unique index if not exists class_summaries_recording_id_key on class_summaries (recording_id);
create unique index if not exists interactive_cards_recording_id_key on interactive_cards (recording_id);

-- Índice para "primer chunk pendiente" (lo consulta cada paso del pipeline).
create index if not exists recording_chunks_recording_pending_idx
  on recording_chunks (recording_id, chunk_index) where not transcribed;

-- Storage: el docente puede reemplazar/borrar archivos de grabaciones
-- (hasta ahora sólo insert/select; el borrado usaba service role).
create policy "recordings bucket: teachers update" on storage.objects
  for update using (bucket_id = 'class-recordings' and auth_role() in ('docente', 'admin'));
create policy "recordings bucket: teachers delete" on storage.objects
  for delete using (bucket_id = 'class-recordings' and auth_role() in ('docente', 'admin'));

-- Exponer error_message en la vista de estado (evita la query extra del panel
-- docente). drop + create porque la columna nueva no va al final.
drop view if exists v_recording_status;
create view v_recording_status
with (security_invoker = true) as
select
  r.id, r.class_id, r.title, r.status, r.progress, r.current_step,
  r.chunks_total, r.chunks_done, r.published, r.duration_seconds, r.created_at,
  r.error_message,
  exists (select 1 from transcripts t where t.recording_id = r.id) as has_transcript,
  exists (select 1 from class_summaries s where s.recording_id = r.id) as has_summary,
  exists (select 1 from interactive_cards ic where ic.recording_id = r.id) as has_cards,
  exists (select 1 from simplified_content sc where sc.recording_id = r.id) as has_simplified
from class_recordings r;

-- ==========================================================================
-- 2. Actividades — adjuntos de entregas por RLS
-- ==========================================================================

-- El estudiante sube adjuntos de sus entregas al bucket privado class-materials
-- bajo entregas/{activityId}/{studentId}/... sin pasar por el service role.
create policy "materials bucket: student uploads own submission files" on storage.objects
  for insert with check (
    bucket_id = 'class-materials'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[3] = auth.uid()::text
    and auth_can_see_activity(((storage.foldername(name))[2])::uuid)
  );

create policy "materials bucket: student replaces own submission files" on storage.objects
  for update using (
    bucket_id = 'class-materials'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

-- Listados del docente (entregas por actividad/estado).
create index if not exists activity_submissions_activity_status_idx
  on activity_submissions (activity_id, status);

-- ==========================================================================
-- 3. Panel docente / clases
-- ==========================================================================

-- Un docente necesita ver los perfiles del resto del cuerpo docente para
-- asignar "docente a cargo" (selector del cronograma e importación CSV).
create policy "profiles: teachers see teaching staff" on profiles
  for select using (
    auth_role() in ('docente', 'admin') and profiles.role in ('docente', 'admin')
  );

-- El bucket class-materials no tenía policy de delete (el borrado usaba
-- service role tras verificar auth_is_teacher_of).
create policy "materials bucket: teachers delete" on storage.objects
  for delete using (
    bucket_id = 'class-materials' and auth_role() in ('docente', 'admin')
  );

-- Índices de apoyo para los listados del docente.
create index if not exists classes_course_date_idx on classes (course_id, class_date, sort_order);
create index if not exists student_checkins_class_idx on student_checkins (class_id, created_at desc);
create index if not exists announcements_course_class_idx on announcements (course_id, class_id, created_at desc);

-- ==========================================================================
-- 4. Notificaciones (bandeja in-app + email/push + campañas + preferencias)
--    Esquema preparado para el módulo de notificaciones; con RLS completa.
-- ==========================================================================

create type notification_kind as enum (
  'aviso', 'actividad_publicada', 'actividad_corregida', 'consulta_respondida',
  'grabacion_publicada', 'debate', 'encuesta', 'alerta_docente', 'manual', 'sistema'
);
create type delivery_channel as enum ('email', 'push');
create type delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failed_count int not null default 0
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

create table notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  -- kinds deshabilitadas explícitamente por el usuario
  muted_kinds notification_kind[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text,
  url text,
  data jsonb not null default '{}',
  course_id uuid references courses(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read_at, created_at desc);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  channel delivery_channel not null,
  status delivery_status not null default 'pending',
  provider_id text,
  error text,
  attempts int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_deliveries_status_idx on notification_deliveries (status, created_at);

-- Envíos manuales del docente/admin (a todo el curso o a seleccionados)
create table notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  created_by uuid not null references profiles(id),
  title text not null,
  body text not null,
  url text,
  channels delivery_channel[] not null default '{email,push}',
  target activity_target not null default 'todos',
  recipient_ids uuid[] not null default '{}',
  recipients_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter publication supabase_realtime add table notifications;

alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;
alter table notifications enable row level security;
alter table notification_deliveries enable row level security;
alter table notification_campaigns enable row level security;

create policy "push_subscriptions: own" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notification_preferences: own" on notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications: own read" on notifications
  for select using (user_id = auth.uid());
create policy "notifications: own mark read" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "deliveries: own read" on notification_deliveries
  for select using (
    exists (select 1 from notifications n where n.id = notification_deliveries.notification_id and n.user_id = auth.uid())
  );

create policy "campaigns: teacher of course or admin" on notification_campaigns
  for all using (
    auth_role() = 'admin' or (course_id is not null and auth_is_teacher_of(course_id))
  ) with check (
    auth_role() = 'admin' or (course_id is not null and auth_is_teacher_of(course_id))
  );

-- Contador de no leídas (para la campanita del shell)
create or replace function unread_notifications_count()
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from notifications where user_id = auth.uid() and read_at is null;
$$;

-- ==========================================================================
-- 5. Ajustes cruzados de integración
-- ==========================================================================

-- Informes: "descartar informe" borra de verdad (antes se marcaba error).
create policy "report_requests: own delete" on report_requests
  for delete using (requested_by = auth.uid() or auth_role() = 'admin');

-- Debates: apoyos en vivo (el cliente ya escucha debate_arguments; con esto
-- puede escuchar también debate_supports).
alter publication supabase_realtime add table debate_supports;
-- Los DELETE de realtime sólo traen la PK salvo replica identity full: la
-- necesitamos para saber qué argumento perdió un apoyo al des-apoyar.
alter table debate_supports replica identity full;

-- Check-ins: un check-in por estudiante y clase (dedupe previo conservando el
-- más antiguo). El cliente pasa a upsert on conflict do nothing.
delete from student_checkins a using student_checkins b
  where a.student_id = b.student_id and a.class_id = b.class_id
    and (a.created_at > b.created_at or (a.created_at = b.created_at and a.ctid > b.ctid));
create unique index if not exists student_checkins_student_class_key
  on student_checkins (student_id, class_id);

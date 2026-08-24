-- Notificaciones: bandeja in-app + entregas por email (Resend) y Web Push (VAPID)
-- + campañas manuales del docente/admin + preferencias por usuario.

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

-- Contador de no leídas (para el campanita del shell)
create or replace function unread_notifications_count()
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from notifications where user_id = auth.uid() and read_at is null;
$$;

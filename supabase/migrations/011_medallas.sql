-- 011: Medallas — gamificación de la interacción con el campus y la materia.
-- Catálogo (badges) + logros por estudiante (student_badges), otorgados por
-- una función SQL que evalúa la actividad real y se dispara sola con cada
-- interacción relevante. El estudiante ve la celebración al volver al campus
-- (student_badges.seen) y el medallero completo en Mi progreso.

create type badge_tier as enum ('bronce', 'plata', 'oro');

create table badges (
  id text primary key,                -- slug estable ("aura-ciberdelito")
  name text not null,
  description text not null,          -- cómo se gana, en lenguaje del estudiante
  icon text not null,                 -- emoji
  tier badge_tier not null default 'bronce',
  sort int not null default 0
);

create table student_badges (
  student_id uuid not null references profiles(id) on delete cascade,
  badge_id text not null references badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  seen boolean not null default false,
  primary key (student_id, badge_id)
);
create index student_badges_unseen_idx on student_badges (student_id) where not seen;

alter table badges enable row level security;
alter table student_badges enable row level security;

create policy "badges: lectura autenticada" on badges
  for select using (auth.uid() is not null);

create policy "student_badges: propias" on student_badges
  for select using (student_id = auth.uid());
create policy "student_badges: marcar vistas" on student_badges
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "student_badges: docentes leen" on student_badges
  for select using (auth_role() in ('docente', 'admin'));

insert into badges (id, name, description, icon, tier, sort) values
  ('bienvenida',        'Bienvenida al futuro',        'Entraste al campus por primera vez.',                                   '🎓', 'bronce', 1),
  ('explorador',        'Explorador del campus',       'Probaste 4 rincones distintos del campus.',                             '🧭', 'bronce', 2),
  ('voz-del-aula',      'Voz del aula',                'Hiciste tu primer check-in contando cómo te resultó una clase.',        '📣', 'bronce', 3),
  ('curioso-juridico',  'Curioso jurídico',            'Le hiciste 3 consultas a Alberdi.',                                     '🦉', 'bronce', 4),
  ('aura-ciberdelito',  'Aura del ciberdelito',        'Participaste en una sesión en vivo de la cátedra.',                     '🕶️', 'plata', 5),
  ('mano-alzada',       'Mano alzada',                 'Escalaste una consulta al equipo docente.',                             '✋', 'plata', 6),
  ('entrega-perfecta',  'Entrega perfecta',            'Entregaste tu primera actividad.',                                      '📬', 'plata', 7),
  ('pico-de-oro',       'Pico de oro',                 'Publicaste tu primer argumento en un debate.',                          '⚖️', 'plata', 8),
  ('racha-encendida',   'Racha encendida',             'Usaste el campus 3 días distintos.',                                    '🔥', 'plata', 9),
  ('crack-nuevas-tec',  'Crack en nuevas tecnologías', 'Dominaste 15 placas de estudio.',                                       '⚡', 'oro', 10),
  ('presencia-total',   'Presencia total',             'Usaste el campus 8 días distintos. Constancia de promoción.',           '🏛️', 'oro', 11),
  ('leyenda-catedra',   'Leyenda de la cátedra',       'Conseguiste 7 medallas. Ya sos parte de la historia de la materia.',    '🏆', 'oro', 12);

-- Evalúa TODOS los criterios contra la actividad real y otorga lo que falte.
-- Idempotente (on conflict do nothing) y barata a esta escala.
create or replace function award_badges(p_student uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_events int;
  v_event_types int;
  v_days int;
  v_checkins int;
  v_alberdi int;
  v_escaladas int;
  v_vivo int;
  v_entregas int;
  v_argumentos int;
  v_placas int;
  v_medallas int;
begin
  select count(*), count(distinct event_type), count(distinct (created_at at time zone 'America/Argentina/Tucuman')::date)
    into v_events, v_event_types, v_days
    from usage_events where student_id = p_student;
  select count(*) into v_checkins from student_checkins where student_id = p_student;
  select count(*) into v_alberdi
    from alberdi_messages m join alberdi_conversations c on c.id = m.conversation_id
    where c.student_id = p_student and m.role = 'user';
  select count(*) into v_escaladas from student_questions where student_id = p_student;
  select count(*) into v_vivo from live_responses where participant_id = p_student;
  select count(*) into v_entregas from activity_submissions
    where student_id = p_student and status in ('entregada', 'corregida');
  select count(*) into v_argumentos from debate_arguments where author_id = p_student;
  select count(*) into v_placas from card_progress where student_id = p_student and known;

  insert into student_badges (student_id, badge_id)
  select p_student, b.id from badges b
  where (b.id = 'bienvenida'       and v_events >= 1)
     or (b.id = 'explorador'       and v_event_types >= 4)
     or (b.id = 'voz-del-aula'     and v_checkins >= 1)
     or (b.id = 'curioso-juridico' and v_alberdi >= 3)
     or (b.id = 'aura-ciberdelito' and v_vivo >= 1)
     or (b.id = 'mano-alzada'      and v_escaladas >= 1)
     or (b.id = 'entrega-perfecta' and v_entregas >= 1)
     or (b.id = 'pico-de-oro'      and v_argumentos >= 1)
     or (b.id = 'racha-encendida'  and v_days >= 3)
     or (b.id = 'crack-nuevas-tec' and v_placas >= 15)
     or (b.id = 'presencia-total'  and v_days >= 8)
  on conflict do nothing;

  select count(*) into v_medallas from student_badges where student_id = p_student;
  if v_medallas >= 7 then
    insert into student_badges (student_id, badge_id)
    values (p_student, 'leyenda-catedra')
    on conflict do nothing;
  end if;
end;
$$;

-- Disparadores: cada interacción relevante re-evalúa las medallas del estudiante.
create or replace function fn_award_on_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_student uuid;
begin
  v_student := case tg_table_name
    when 'usage_events' then new.student_id
    when 'student_checkins' then new.student_id
    when 'student_questions' then new.student_id
    when 'activity_submissions' then new.student_id
    when 'card_progress' then new.student_id
    when 'live_responses' then new.participant_id
    when 'debate_arguments' then new.author_id
  end;
  if v_student is not null then
    perform award_badges(v_student);
  end if;
  return new;
end;
$$;

create trigger trg_badges_usage after insert on usage_events
  for each row execute function fn_award_on_activity();
create trigger trg_badges_checkin after insert on student_checkins
  for each row execute function fn_award_on_activity();
create trigger trg_badges_question after insert on student_questions
  for each row execute function fn_award_on_activity();
create trigger trg_badges_submission after insert or update of status on activity_submissions
  for each row execute function fn_award_on_activity();
create trigger trg_badges_cards after insert or update of known on card_progress
  for each row execute function fn_award_on_activity();
create trigger trg_badges_vivo after insert on live_responses
  for each row execute function fn_award_on_activity();
create trigger trg_badges_debate after insert on debate_arguments
  for each row execute function fn_award_on_activity();

-- Consultas a Alberdi: el student sale de la conversación, no de la fila.
create or replace function fn_award_on_activity_alberdi()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_student uuid;
begin
  if new.role = 'user' then
    select student_id into v_student from alberdi_conversations where id = new.conversation_id;
    if v_student is not null then
      perform award_badges(v_student);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_badges_alberdi after insert on alberdi_messages
  for each row execute function fn_award_on_activity_alberdi();

-- Backfill: otorga lo ya ganado por la actividad histórica.
do $$
declare r record;
begin
  for r in select id from profiles where role = 'estudiante' loop
    perform award_badges(r.id);
  end loop;
end;
$$;

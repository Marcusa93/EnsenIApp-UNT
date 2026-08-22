-- EnsenIA UNT — 003: transcripción resumible por chunks
-- El navegador comprime el audio (16 kHz mono mp3) y lo sube en partes de
-- <= 10 min. El pipeline avanza de a un paso por request (state machine en DB)
-- para respetar los timeouts de funciones serverless y poder reanudar.

create table recording_chunks (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references class_recordings(id) on delete cascade,
  chunk_index int not null,
  storage_path text not null,
  start_seconds numeric(10,3) not null default 0,
  duration_seconds numeric(10,3),
  size_bytes bigint,
  transcribed boolean not null default false,
  text text,
  segments jsonb not null default '[]',
  error_message text,
  created_at timestamptz not null default now(),
  unique (recording_id, chunk_index)
);

alter table class_recordings
  add column chunks_total int not null default 0,
  add column chunks_done int not null default 0,
  add column transcription_model text,
  add column generation_model text;

alter table recording_chunks enable row level security;

create policy "chunks: teacher of course" on recording_chunks
  for all using (
    exists (
      select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = recording_chunks.recording_id
        and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  ) with check (
    exists (
      select 1 from class_recordings r join classes c on c.id = r.class_id
      where r.id = recording_chunks.recording_id
        and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

-- El docente puede actualizar metadatos de su grabación (título, publicar)
-- (la policy "for all" de 002 ya lo cubre; esta vista resume el estado)
create or replace view v_recording_status
with (security_invoker = true) as
select
  r.id, r.class_id, r.title, r.status, r.progress, r.current_step,
  r.chunks_total, r.chunks_done, r.published, r.duration_seconds, r.created_at,
  exists (select 1 from transcripts t where t.recording_id = r.id) as has_transcript,
  exists (select 1 from class_summaries s where s.recording_id = r.id) as has_summary,
  exists (select 1 from interactive_cards ic where ic.recording_id = r.id) as has_cards,
  exists (select 1 from simplified_content sc where sc.recording_id = r.id) as has_simplified
from class_recordings r;

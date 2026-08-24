-- EnsenIA UNT — pendiente (módulo pipeline de grabaciones)
-- Nada de esto es bloqueante: el código funciona sin aplicarlo (usa delete+insert
-- y el service role donde hace falta). Mejora integridad y permite gestionar
-- archivos del bucket sin pasar por el service role.

-- 1) Una sola fila de resumen / placas por grabación (el pipeline hace delete+insert;
--    con la constraint puede pasar a upsert on conflict (recording_id)).
create unique index if not exists class_summaries_recording_id_key on class_summaries (recording_id);
create unique index if not exists interactive_cards_recording_id_key on interactive_cards (recording_id);

-- 2) Índice para "primer chunk pendiente" (lo consulta cada paso).
create index if not exists recording_chunks_recording_pending_idx
  on recording_chunks (recording_id, chunk_index) where not transcribed;

-- 3) Storage: el docente puede reemplazar/borrar archivos de grabaciones (hoy sólo insert/select).
create policy "recordings bucket: teachers update" on storage.objects
  for update using (bucket_id = 'class-recordings' and auth_role() in ('docente', 'admin'));
create policy "recordings bucket: teachers delete" on storage.objects
  for delete using (bucket_id = 'class-recordings' and auth_role() in ('docente', 'admin'));

-- 4) Exponer error_message en la vista de estado (evita la query extra del panel docente).
create or replace view v_recording_status
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

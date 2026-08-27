-- 013: el estudiante puede escuchar la clase.
-- Los chunks de audio (recording_chunks) eran sólo del docente; el estudiante
-- inscripto ahora puede leer los metadatos de los chunks de grabaciones
-- PUBLICADAS para armar el reproductor (las URLs firmadas salen del bucket,
-- cuya policy de lectura ya cubre a cualquier autenticado).

create policy "chunks: estudiante escucha publicadas" on recording_chunks
  for select using (
    exists (
      select 1
      from class_recordings r
      join classes c on c.id = r.class_id
      where r.id = recording_chunks.recording_id
        and r.published
        and auth_is_enrolled(c.course_id)
    )
  );

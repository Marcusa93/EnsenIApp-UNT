-- EnsenIA UNT — pendiente (módulo actividades)
-- Permite que el estudiante suba adjuntos de sus entregas al bucket privado
-- class-materials bajo entregas/{activityId}/{studentId}/... sin pasar por el
-- service role. Mientras no se aplique, la subida se hace vía Server Action
-- con createAdminClient() tras verificar permisos a mano (ver
-- src/app/campus/estudiante/actividades/[activityId]/actions.ts).

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

-- Índice de apoyo para los listados del docente (entregas por actividad/estado).
create index if not exists activity_submissions_activity_status_idx
  on activity_submissions (activity_id, status);

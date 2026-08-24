-- EnsenIA UNT — pendiente (módulo docente-panel-clases)
-- 1) Un docente necesita ver los perfiles del resto del cuerpo docente para
--    asignar "docente a cargo" en el cronograma (selector e importación CSV).
--    Hoy RLS sólo le muestra su propio perfil y los de sus inscriptos.
create policy "profiles: teachers see teaching staff" on profiles
  for select using (
    auth_role() in ('docente', 'admin') and profiles.role in ('docente', 'admin')
  );

-- 2) El bucket class-materials no tiene policy de delete: hoy el borrado del
--    archivo se hace con service role desde la Server Action tras verificar
--    auth_is_teacher_of. Con esta policy podría hacerse con el cliente RLS.
create policy "materials bucket: teachers delete" on storage.objects
  for delete using (
    bucket_id = 'class-materials' and auth_role() in ('docente', 'admin')
  );

-- 3) Índices de apoyo para los listados del docente.
create index if not exists classes_course_date_idx on classes (course_id, class_date, sort_order);
create index if not exists student_checkins_class_idx on student_checkins (class_id, created_at desc);
create index if not exists announcements_course_class_idx on announcements (course_id, class_id, created_at desc);

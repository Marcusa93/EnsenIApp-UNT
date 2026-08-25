-- EnsenIA UNT — 005: correcciones de seguridad (RLS/esquema)
-- Hallazgos confirmados de la auditoría:
--   1. profiles: self update permitía autopromoverse a admin / autovalidarse.
--   2. Buckets class-recordings y class-materials legibles por cualquier
--      usuario autenticado (IDOR de entregas/materiales/grabaciones ajenos).
--   3. enrollments: student self-enroll permitía autoinscribirse a cualquier curso.
--   4. activity_submissions: el estudiante podía autoasignarse nota/estado.
--   5. Falta índice en class_recordings(class_id).

-- ---------------------------------------------------------------------------
-- Helper: cast seguro de text a uuid (evita que una ruta de storage con un
-- primer segmento no-uuid rompa la evaluación de policies con una excepción).
-- ---------------------------------------------------------------------------
create or replace function public.try_uuid(v text)
returns uuid
language plpgsql immutable
as $$
begin
  return v::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles: el usuario puede editar su fila pero NO role ni status.
--    Defensa en dos capas: WITH CHECK en la policy + trigger BEFORE UPDATE.
-- ---------------------------------------------------------------------------
-- Estado actual del perfil propio, sin re-entrar en RLS de profiles
-- (un subselect directo en la policy causa "infinite recursion detected").
create or replace function public.auth_profile_status()
returns profile_status
language sql stable security definer set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

drop policy "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.auth_role()
    and status = public.auth_profile_status()
  );

-- Trigger de refuerzo: bloquea cambios de role/status hechos por usuarios
-- finales (rol de DB authenticated/anon) que no sean admin de la app.
-- Corre como invoker: los flujos legítimos pasan igual porque
--   * el panel admin y las acciones docentes usan service_role,
--   * handle_new_user / roster_match_existing son security definer (postgres).
create or replace function public.protect_profile_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    if current_user in ('authenticated', 'anon')
       and coalesce(public.auth_role() = 'admin', false) is not true then
      raise exception 'No tenés permiso para cambiar el rol o el estado de un perfil.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_cols on public.profiles;
create trigger trg_protect_profile_privileged_cols
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_cols();

-- ---------------------------------------------------------------------------
-- 2. Storage: lectura por pertenencia real, no "cualquier autenticado".
--    class-recordings: objetos en {recordingId}/chunk-N.mp3 → docente del
--    curso siempre; estudiante inscripto sólo si la grabación está publicada.
--    class-materials: {classId}/{archivo} para materiales (miembros del curso)
--    y entregas/{activityId}/{studentId}/{archivo} (el propio estudiante o el
--    docente del curso de esa actividad). Admin ve todo.
--    Las subidas/descargas legítimas ya pasan por estas identidades (los
--    procesos de fondo usan service role, que bypassa RLS).
-- ---------------------------------------------------------------------------
drop policy "recordings bucket: members read" on storage.objects;
create policy "recordings bucket: members read" on storage.objects
  for select using (
    bucket_id = 'class-recordings'
    and (
      public.auth_role() = 'admin'
      or exists (
        select 1
        from public.class_recordings r
        join public.classes c on c.id = r.class_id
        where r.id = public.try_uuid((storage.foldername(name))[1])
          and (
            public.auth_is_teacher_of(c.course_id)
            or (public.auth_is_enrolled(c.course_id) and r.published)
          )
      )
    )
  );

drop policy "materials bucket: members read" on storage.objects;
create policy "materials bucket: members read" on storage.objects
  for select using (
    bucket_id = 'class-materials'
    and (
      public.auth_role() = 'admin'
      or (
        (storage.foldername(name))[1] = 'entregas'
        and (
          (storage.foldername(name))[3] = auth.uid()::text
          or exists (
            select 1 from public.activities a
            where a.id = public.try_uuid((storage.foldername(name))[2])
              and public.auth_is_teacher_of(a.course_id)
          )
        )
      )
      or (
        (storage.foldername(name))[1] <> 'entregas'
        and exists (
          select 1 from public.classes c
          where c.id = public.try_uuid((storage.foldername(name))[1])
            and (public.auth_is_enrolled(c.course_id) or public.auth_is_teacher_of(c.course_id))
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. enrollments: fuera la autoinscripción libre. El alta legítima ocurre por
--    el trigger de padrón (security definer) o por docente/admin; ningún
--    código de la app usa esta policy.
-- ---------------------------------------------------------------------------
drop policy "enrollments: student self-enroll" on public.enrollments;

-- ---------------------------------------------------------------------------
-- 4. activity_submissions: el estudiante no puede tocar campos de corrección
--    ni pasar su entrega a 'corregida'.
--    WITH CHECK limita los estados alcanzables; el trigger congela las
--    columnas docentes comparando OLD/NEW (soporta 'reabierta' con nota
--    previa: mientras el estudiante no las CAMBIE, puede seguir editando).
-- ---------------------------------------------------------------------------
drop policy "submissions: student updates own while open" on public.activity_submissions;
create policy "submissions: student updates own while open" on public.activity_submissions
  for update using (student_id = auth.uid() and status in ('en_progreso', 'reabierta'))
  with check (
    student_id = auth.uid()
    and status in ('en_progreso', 'entregada', 'reabierta')
  );

-- Explicita el WITH CHECK del docente (antes heredaba el USING).
drop policy "submissions: teacher grades" on public.activity_submissions;
create policy "submissions: teacher grades" on public.activity_submissions
  for update using (
    exists (select 1 from public.activities a where a.id = activity_submissions.activity_id
      and (public.auth_is_teacher_of(a.course_id) or public.auth_role() = 'admin'))
  ) with check (
    exists (select 1 from public.activities a where a.id = activity_submissions.activity_id
      and (public.auth_is_teacher_of(a.course_id) or public.auth_role() = 'admin'))
  );

create or replace function public.protect_submission_grading_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Procesos de fondo (service role) y funciones security definer pasan.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Admin de la app y docentes del curso de la actividad pasan.
  if public.auth_role() = 'admin' then
    return new;
  end if;
  if exists (
    select 1 from public.activities a
    where a.id = new.activity_id and public.auth_is_teacher_of(a.course_id)
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.score is not null
       or new.teacher_feedback_md is not null
       or new.ai_feedback_md is not null
       or new.graded_at is not null
       or new.graded_by is not null
       or new.status = 'corregida' then
      raise exception 'No podés crear una entrega con campos de corrección.';
    end if;
    return new;
  end if;

  if new.score is distinct from old.score
     or new.teacher_feedback_md is distinct from old.teacher_feedback_md
     or new.ai_feedback_md is distinct from old.ai_feedback_md
     or new.graded_at is distinct from old.graded_at
     or new.graded_by is distinct from old.graded_by
     or (new.status = 'corregida' and old.status is distinct from 'corregida') then
    raise exception 'No podés modificar los campos de corrección de una entrega.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_submission_grading_cols on public.activity_submissions;
create trigger trg_protect_submission_grading_cols
  before insert or update on public.activity_submissions
  for each row execute function public.protect_submission_grading_cols();

-- ---------------------------------------------------------------------------
-- 5. Índice faltante: class_recordings.class_id (panel docente, vista del
--    estudiante, informes y el ON DELETE CASCADE desde classes).
-- ---------------------------------------------------------------------------
create index if not exists class_recordings_class_idx
  on public.class_recordings (class_id, created_at desc);

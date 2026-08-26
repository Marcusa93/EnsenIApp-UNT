-- 008: el estudiante que entra queda conectado a la comisión.
--
-- Problema que resuelve: quien ingresa con nombre y apellido (sesión anónima)
-- no quedaba inscripto en ningún curso, así que el campus le aparecía vacío
-- ("Todavía no estás inscripto en ninguna comisión") y no podía ver clases,
-- materiales ni actividades. Mientras no exista padrón cargado, el acceso es
-- abierto: entrar = quedar en la comisión por defecto.

-- Comisión a la que caen los ingresos sin padrón. Única fuente de verdad
-- (en vez de hardcodear un UUID en el código de la app).
alter table courses add column is_default boolean not null default false;

-- Un solo curso puede ser el default.
create unique index courses_single_default_idx on courses (is_default) where is_default;

update courses set is_default = true
where id = (select id from courses order by created_at limit 1);

create or replace function default_course_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from courses where is_default limit 1;
$$;

-- El trigger de alta ahora inscribe: por padrón si el email está cargado,
-- o en la comisión por defecto si es un ingreso abierto (anónimo).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_status profile_status;
  v_matched boolean := false;
  v_default uuid;
begin
  v_status := case when new.is_anonymous then 'validado' else 'pendiente' end;

  insert into public.profiles (id, full_name, email, role, avatar_url, is_anonymous, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Estudiante'),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'estudiante'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.is_anonymous, false),
    v_status
  );

  if new.email is not null then
    for r in select * from public.roster where lower(email) = lower(new.email) loop
      v_matched := true;
      v_status := 'validado';
      update public.roster set matched_profile_id = new.id where id = r.id;
      insert into public.enrollments (student_id, course_id)
      values (new.id, r.course_id)
      on conflict do nothing;
    end loop;
    update public.profiles set status = v_status where id = new.id;
  end if;

  -- Acceso abierto: sin padrón que lo ubique, va a la comisión por defecto.
  -- Sólo estudiantes: docentes y admin se asignan desde Administración.
  if not v_matched and coalesce((new.raw_user_meta_data->>'role')::user_role, 'estudiante') = 'estudiante' then
    v_default := public.default_course_id();
    if v_default is not null then
      insert into public.enrollments (student_id, course_id)
      values (new.id, v_default)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- Backfill: los que ya entraron y quedaron sin comisión.
insert into enrollments (student_id, course_id)
select p.id, default_course_id()
from profiles p
where p.role = 'estudiante'
  and default_course_id() is not null
  and not exists (select 1 from enrollments e where e.student_id = p.id)
on conflict do nothing;

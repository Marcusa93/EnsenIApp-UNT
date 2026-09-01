-- 030: un alta por email que no está en el padrón no entra a la comisión.
--
-- El agujero: `handle_new_user`, cuando el email no coincidía con el padrón,
-- inscribía igual en la comisión por defecto. Como la API de registro está
-- abierta (tiene que estarlo: el acceso anónimo "entrar con tu nombre" usa el
-- mismo endpoint), cualquiera con la URL podía crearse una cuenta y aparecer
-- adentro del curso, mezclado con los estudiantes reales.
--
-- Apagar el registro entero no sirve: probado, se lleva puesto el acceso
-- anónimo, que es una función querida. La distinción correcta no es "quién
-- puede crear cuenta" sino "quién entra a la comisión":
--
--   - anónimo (entra con su nombre)  → sí, es el acceso abierto de la cátedra
--   - email en el padrón             → sí, y validado
--   - email fuera del padrón         → NO: queda pendiente y sin comisión,
--                                      hasta que la cátedra lo valide a mano
--
-- Las altas que hace la cátedra (panel de Administración y los scripts de seed)
-- no dependen de esto: inscriben ellas mismas, explícitamente.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_matched boolean := false;
  v_default uuid;
  v_status profile_status;
begin
  v_status := case when new.is_anonymous then 'validado' else 'pendiente' end;

  insert into public.profiles (id, full_name, email, role, avatar_url, is_anonymous, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Invitado'), '@', 1)),
    coalesce(new.email, ''),
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

  -- Acceso abierto: SÓLO para quien entra sin email (con su nombre). Con email
  -- y sin padrón, la cuenta queda pendiente y afuera hasta que alguien la valide.
  if not v_matched
     and coalesce(new.is_anonymous, false)
     and coalesce((new.raw_user_meta_data->>'role')::user_role, 'estudiante') = 'estudiante' then
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

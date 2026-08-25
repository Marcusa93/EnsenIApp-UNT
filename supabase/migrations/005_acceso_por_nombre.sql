-- 005: acceso rápido sólo con nombre y apellido (sesión anónima de Supabase).
-- Se puede "vincular" (linkIdentity) a un email/Google real más adelante sin
-- perder el historial: mismo auth.users.id, mismo profiles.id.

alter table profiles
  alter column email drop not null,
  add column is_anonymous boolean not null default false;

-- profiles_email_key (unique) sigue activa: Postgres permite múltiples NULL.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_status profile_status;
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
      v_status := 'validado';
      update public.roster set matched_profile_id = new.id where id = r.id;
      insert into public.enrollments (student_id, course_id)
      values (new.id, r.course_id)
      on conflict do nothing;
    end loop;
    update public.profiles set status = v_status where id = new.id;
  end if;

  return new;
end;
$$;

-- Al vincular una identidad real (Google/email) a una sesión anónima, Supabase
-- actualiza auth.users.email e is_anonymous pasa a false: reflejarlo y re-evaluar el padrón.
create or replace function handle_user_linked()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
begin
  if old.is_anonymous and not new.is_anonymous then
    update public.profiles
      set email = new.email,
          is_anonymous = false,
          full_name = coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', profiles.full_name)
      where id = new.id;

    if new.email is not null then
      for r in select * from public.roster where lower(email) = lower(new.email) loop
        update public.roster set matched_profile_id = new.id where id = r.id;
        update public.profiles set status = 'validado' where id = new.id;
        insert into public.enrollments (student_id, course_id)
        values (new.id, r.course_id)
        on conflict do nothing;
      end loop;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_linked
  after update of is_anonymous, email on auth.users
  for each row execute function handle_user_linked();

-- Ya no hay email para validar "único por sesión" en anónimos: el nombre puede
-- repetirse entre estudiantes (esperable con nombre y apellido). No se agrega
-- constraint de unicidad sobre full_name.

-- 029: obligar a cambiar la contraseña inicial.
--
-- Las cuentas que crea la cátedra nacen con una contraseña provisoria que viaja
-- por WhatsApp o se dicta en el aula: la sabe quien la mandó, quien la recibió
-- y cualquiera que haya visto la pantalla. Mientras siga puesta, la cuenta no
-- es realmente del estudiante.
--
-- Con esta marca, la primera vez que entra el campus le pide cambiarla antes de
-- dejarlo hacer otra cosa. Se apaga sola cuando la cambia (ver el trigger de
-- abajo, que escucha el cambio en auth.users).

alter table profiles
  add column must_change_password boolean not null default false;

comment on column profiles.must_change_password is
  'true = entró con una contraseña provisoria puesta por la cátedra y todavía no la cambió.';

/**
 * Apaga la marca cuando la persona efectivamente cambia su contraseña.
 *
 * Escucha auth.users porque es ahí donde Supabase guarda el hash: así la marca
 * se limpia sola sin que la app tenga que acordarse de hacerlo, venga el cambio
 * de donde venga (el formulario del campus, un reset por email, lo que sea).
 */
create or replace function fn_marcar_clave_cambiada()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update profiles set must_change_password = false
     where id = new.id and must_change_password;
  end if;
  return new;
end;
$$;

create trigger trg_marcar_clave_cambiada after update on auth.users
  for each row execute function fn_marcar_clave_cambiada();

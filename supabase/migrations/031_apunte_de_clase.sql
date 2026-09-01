-- 031: el apunte de clase — para las clases que no se graban.
--
-- Hasta ahora todo el contenido del campus colgaba de una grabación:
-- transcripción → resumen → placas → desafíos de juego. Pero no todas las
-- clases se graban, y esas quedaban como un hueco: al estudiante le decía "el
-- equipo docente está procesando la clase" (mentira, no había nada procesando),
-- y el docente no tenía forma de generar desafíos para ellas.
--
-- El apunte es la otra puerta de entrada: el docente escribe (o pega) el
-- material de la clase y con eso alcanza para que la clase tenga contenido,
-- Alberdi pueda responder sobre ella y el generador de juegos arme su banco de
-- preguntas. Una clase sin grabación deja de ser una clase vacía.
--
-- Una fila por clase (la clase es la PK): el apunte es EL texto de esa clase,
-- no una lista. Para lo que sí es lista está class_materials.

create table class_notes (
  class_id uuid primary key references classes(id) on delete cascade,
  /** Markdown, como lo escribió el docente. Es lo que ve el estudiante. */
  body_md text not null,
  /** Apagado, el apunte queda como borrador y la comisión no lo ve. */
  published boolean not null default true,
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table class_notes enable row level security;

-- El curso sale SIEMPRE de la clase, nunca de una columna propia: si el
-- course_id fuera un campo de esta tabla, un docente podría escribir una fila
-- con el curso que sí le corresponde apuntando a una clase de otra comisión.
create policy "class_notes: la comisión lee lo publicado" on class_notes
  for select using (
    exists (
      select 1 from classes c
      where c.id = class_notes.class_id
        and (
          (class_notes.published and auth_is_enrolled(c.course_id))
          or auth_is_teacher_of(c.course_id)
          or auth_role() = 'admin'
        )
    )
  );

create policy "class_notes: el docente de la comisión escribe" on class_notes
  for all using (
    exists (
      select 1 from classes c
      where c.id = class_notes.class_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = class_notes.class_id and (auth_is_teacher_of(c.course_id) or auth_role() = 'admin')
    )
  );

create or replace function public.fn_touch_class_notes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_touch_class_notes
  before update on class_notes
  for each row execute function public.fn_touch_class_notes();

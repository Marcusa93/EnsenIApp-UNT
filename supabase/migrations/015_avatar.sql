-- 015: el operador — avatar con equipamiento que se gana jugando.
--
-- El concepto sale del propio programa: "La era de la abogacía aumentada"
-- (Clase 23). Cada estudiante arma un OPERADOR JURÍDICO y lo va equipando con
-- lo que la materia discute: módulos de análisis, togas técnicas, instrumentos
-- de litigio, drones asesores. No es decoración pegada encima del juego — cada
-- ítem representa una capacidad de la que habla la cursada.
--
-- Todo el arte es SVG por capas dibujado en el front (src/components/avatar):
-- acá sólo vive QUÉ existe, QUÉ tiene puesto cada uno y CÓMO se desbloquea.
-- Decisión deliberada: nada de imágenes ni modelos 3D, que en un celular con
-- datos móviles serían cientos de KB o megas por avatar.

create type avatar_slot as enum ('visor', 'toga', 'instrumento', 'companion', 'aura', 'fondo');
create type avatar_rarity as enum ('comun', 'raro', 'epico', 'legendario');

-- Cómo se gana un ítem. 'inicio' = lo tenés desde que creás el operador.
create type avatar_req as enum ('inicio', 'nivel', 'racha', 'aciertos', 'partidas', 'medalla');

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

create table avatar_items (
  id text primary key,                  -- slug estable, es la clave del SVG en el front
  name text not null,
  /** Qué representa, en lenguaje de la materia. */
  description text not null,
  slot avatar_slot not null,
  rarity avatar_rarity not null default 'comun',
  req_kind avatar_req not null default 'inicio',
  /** Umbral para nivel/racha/aciertos/partidas. */
  req_value int not null default 0,
  /** Medalla necesaria cuando req_kind = 'medalla'. */
  req_badge text references badges(id) on delete set null,
  sort int not null default 0
);

alter table avatar_items enable row level security;

create policy "avatar_items: lectura autenticada" on avatar_items
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- El operador de cada estudiante
-- ---------------------------------------------------------------------------

create table student_avatars (
  student_id uuid primary key references profiles(id) on delete cascade,
  /** Nombre de operador: lo elige el estudiante, no es su nombre real. */
  callsign text not null,
  /** Silueta del chasis (redondo / angular / encapuchado). */
  chassis text not null default 'redondo',
  /** Tono del chasis y color de luz: la identidad visual propia. */
  tone text not null default 'acero',
  glow text not null default 'violeta',
  /** Qué tiene puesto en cada slot: { visor: "visor-basico", toga: "...", ... } */
  equipped jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_student_avatars_updated
  before update on student_avatars
  for each row execute function set_updated_at();

alter table student_avatars enable row level security;

create policy "student_avatars: propio" on student_avatars
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- La comisión se ve entre sí en la tabla de posiciones: el avatar es público
-- dentro del campus (no expone ningún dato personal, es un muñeco y un alias).
create policy "student_avatars: lectura autenticada" on student_avatars
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------

create table student_avatar_items (
  student_id uuid not null references profiles(id) on delete cascade,
  item_id text not null references avatar_items(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  /** Para poder mostrar "¡desbloqueaste algo nuevo!" una sola vez. */
  seen boolean not null default false,
  primary key (student_id, item_id)
);
create index student_avatar_items_unseen_idx on student_avatar_items (student_id) where not seen;

alter table student_avatar_items enable row level security;

create policy "student_avatar_items: propios" on student_avatar_items
  for select using (student_id = auth.uid());
create policy "student_avatar_items: marcar vistos" on student_avatar_items
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "student_avatar_items: docentes leen" on student_avatar_items
  for select using (auth_role() in ('docente', 'admin'));

-- ---------------------------------------------------------------------------
-- Desbloqueo
-- ---------------------------------------------------------------------------

-- Evalúa TODO el catálogo contra el progreso real del estudiante y le da lo que
-- corresponda. Idempotente, igual que award_badges: se puede llamar de más.
create or replace function unlock_avatar_items(p_student uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_xp int;
  v_racha int;
  v_aciertos int;
  v_partidas int;
  v_nivel int;
begin
  -- Sin operador creado todavía no hay nada que desbloquear.
  if not exists (select 1 from student_avatars where student_id = p_student) then
    return;
  end if;

  select coalesce(max(xp), 0), coalesce(max(best_streak), 0),
         coalesce(sum(correct), 0), coalesce(sum(runs), 0)
    into v_xp, v_racha, v_aciertos, v_partidas
    from student_game_stats where student_id = p_student;

  -- Umbrales espejo de LEVELS en src/lib/games/config.ts. Si cambian allá,
  -- cambian acá: es la única duplicación y está acotada a esta función.
  v_nivel := case
    when v_xp >= 7500 then 12 when v_xp >= 5800 then 11 when v_xp >= 4300 then 10
    when v_xp >= 3200 then 9  when v_xp >= 2300 then 8  when v_xp >= 1600 then 7
    when v_xp >= 1100 then 6  when v_xp >= 700  then 5  when v_xp >= 400  then 4
    when v_xp >= 200  then 3  when v_xp >= 80   then 2  else 1 end;

  insert into student_avatar_items (student_id, item_id)
  select p_student, i.id
    from avatar_items i
   where (i.req_kind = 'inicio')
      or (i.req_kind = 'nivel'     and v_nivel    >= i.req_value)
      or (i.req_kind = 'racha'     and v_racha    >= i.req_value)
      or (i.req_kind = 'aciertos'  and v_aciertos >= i.req_value)
      or (i.req_kind = 'partidas'  and v_partidas >= i.req_value)
      or (i.req_kind = 'medalla'   and i.req_badge is not null
          and exists (select 1 from student_badges sb
                       where sb.student_id = p_student and sb.badge_id = i.req_badge))
  on conflict do nothing;
end;
$$;

create or replace function fn_unlock_on_game_run()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform unlock_avatar_items(new.student_id);
  return new;
end;
$$;

-- Corre DESPUÉS de trg_apply_game_run (orden alfabético: apply < badges < unlock),
-- así lee el XP y la racha ya actualizados por esa partida.
create trigger trg_unlock_avatar after insert on game_runs
  for each row execute function fn_unlock_on_game_run();

-- Las medallas también abren ítems, así que al ganar una se re-evalúa.
create or replace function fn_unlock_on_badge()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform unlock_avatar_items(new.student_id);
  return new;
end;
$$;

create trigger trg_unlock_avatar_badge after insert on student_badges
  for each row execute function fn_unlock_on_badge();

-- ---------------------------------------------------------------------------
-- Catálogo inicial: 28 ítems
-- ---------------------------------------------------------------------------

insert into avatar_items (id, name, description, slot, rarity, req_kind, req_value, req_badge, sort) values
  -- VISOR: el módulo de análisis. Es lo que "lee" el expediente.
  ('visor-basico',    'Visor de Cursante',      'Lente de lectura asistida. Lo básico para empezar a leer un expediente.',            'visor', 'comun',      'inicio',   0,  null, 1),
  ('visor-lente',     'Lente Analítica',        'Resalta los hechos relevantes de un caso mientras leés.',                             'visor', 'comun',      'nivel',    2,  null, 2),
  ('visor-tactico',   'Visor Táctico',          'Contrasta tu argumento contra la norma en tiempo real.',                              'visor', 'raro',       'nivel',    4,  null, 3),
  ('visor-corona',    'Corona de Datos',        'Procesa jurisprudencia en paralelo. Se nota cuando entrás a una audiencia.',          'visor', 'epico',      'nivel',    7,  null, 4),
  ('visor-magistral', 'Diadema Magistral',      'Reservada a quien ya no consulta la norma: la anticipa.',                             'visor', 'legendario', 'nivel',   10,  null, 5),

  -- TOGA: la vestimenta profesional, aumentada.
  ('toga-cursante',   'Toga de Cursante',       'Tela común de la facultad. Todos empezamos acá.',                                     'toga', 'comun',      'inicio',   0,  null, 10),
  ('toga-reforzada',  'Toga Reforzada',         'Trama técnica que aguanta una audiencia larga sin arrugarse.',                        'toga', 'comun',      'nivel',    3,  null, 11),
  ('toga-fibra',      'Toga de Fibra Óptica',   'Los ribetes transportan datos del expediente mientras hablás.',                       'toga', 'raro',       'nivel',    5,  null, 12),
  ('toga-procesal',   'Manto Procesal',         'Blindaje contra la nulidad. Metafórico, pero se siente.',                             'toga', 'epico',      'nivel',    8,  null, 13),
  ('toga-corte',      'Toga de la Corte',       'La que se usa cuando la decisión que tomás sienta precedente.',                       'toga', 'legendario', 'nivel',   11,  null, 14),

  -- INSTRUMENTO: la herramienta de litigio.
  ('inst-codice',     'Códice Digital',         'Tu primer repositorio de normas. Pesa menos que el Código impreso.',                  'instrumento', 'comun',      'inicio',  0,  null, 20),
  ('inst-mazo',       'Mazo Holográfico',       'Marca el cierre de un argumento. El sonido es opcional.',                             'instrumento', 'comun',      'nivel',   3,  null, 21),
  ('inst-balanza',    'Balanza Cuántica',       'Pondera intereses en conflicto y te muestra el punto de equilibrio.',                 'instrumento', 'raro',       'nivel',   6,  null, 22),
  ('inst-sello',      'Sello de Autoridad',     'Certifica y firma. Nadie discute un documento que pasó por acá.',                     'instrumento', 'epico',      'nivel',   9,  null, 23),
  ('inst-magno',      'Códice Magno',           'Contiene todo lo que la cátedra enseñó, y lo que se viene.',                          'instrumento', 'legendario', 'nivel',  12,  null, 24),

  -- COMPAÑERO: se gana con constancia, no con XP. Premia el hábito.
  ('comp-dron',       'Dron Asistente',         'Te sigue y toma nota. Se ganó volviendo tres días seguidos.',                         'companion', 'comun',      'racha',    3,  null, 30),
  ('comp-asesor',     'Dron Asesor',            'Ya no sólo toma nota: te sugiere por dónde atacar el caso.',                          'companion', 'raro',       'racha',    5,  null, 31),
  ('comp-enjambre',   'Enjambre Analítico',     'Tres unidades rastreando precedentes a la vez. Diez días de constancia.',             'companion', 'epico',      'racha',   10,  null, 32),
  ('comp-testigo',    'Testigo Silente',        'Registra el momento exacto en que se dijo cada cosa.',                                'companion', 'epico',      'medalla',  0,  'oido-fino', 33),

  -- AURA: el efecto alrededor. Se gana con volumen de práctica.
  ('aura-pulso',      'Pulso de Datos',         'Tu presencia empieza a notarse en la sala.',                                          'aura', 'comun',      'partidas',   5,  null, 40),
  ('aura-campo',      'Campo Argumental',       'Veinticinco aciertos sostienen un campo difícil de rebatir.',                         'aura', 'raro',       'aciertos',  25,  null, 41),
  ('aura-tormenta',   'Tormenta de Precedentes','Cien aciertos. Los fallos orbitan alrededor tuyo.',                                   'aura', 'epico',      'aciertos', 100,  null, 42),
  ('aura-catedra',    'Aura de la Cátedra',     'Sólo para quien ya es parte de la historia de la materia.',                           'aura', 'legendario', 'medalla',    0,  'leyenda-catedra', 43),

  -- FONDO: dónde estás parado. Marca el ascenso en la carrera.
  ('fondo-aula',      'Aula de la Facultad',    'Donde empieza todo.',                                                                 'fondo', 'comun',      'inicio',   0,  null, 50),
  ('fondo-estrado',   'Estrado',                'Ya no mirás la audiencia desde el banco.',                                            'fondo', 'comun',      'nivel',    3,  null, 51),
  ('fondo-servidor',  'Servidor Central',       'El expediente digital, por dentro.',                                                  'fondo', 'raro',       'nivel',    6,  null, 52),
  ('fondo-corte',     'Corte Digital',          'La última instancia. Se llega, no se entra.',                                         'fondo', 'legendario', 'nivel',   10,  null, 53),
  ('fondo-ciber',     'Sala de Ciberdelito',    'Reservada a quien se ganó el aura del ciberdelito.',                                  'fondo', 'epico',      'medalla',  0,  'aura-ciberdelito', 54)
on conflict (id) do nothing;

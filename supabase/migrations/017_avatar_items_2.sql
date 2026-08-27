-- 017: segunda tanda de equipo para el operador.
--
-- Los 28 primeros marcaban el ascenso genérico en la carrera. Estos 16 se atan a
-- los BLOQUES TEMÁTICOS reales del programa: ciberdelito, datos personales,
-- bioderecho, criptoeconomía e IA generativa. La idea es que el equipo cuente
-- qué parte de la materia dominás, no sólo cuánto jugaste.
--
-- Además se agregan piezas de rareza alta con requisitos exigentes: el vestidor
-- ahora deja PROBARSE lo bloqueado, así que conviene que haya cosas lejanas y
-- vistosas para querer alcanzar.

insert into avatar_items (id, name, description, slot, rarity, req_kind, req_value, req_badge, sort) values
  -- VISOR -------------------------------------------------------------------
  ('visor-forense',   'Visor Forense',          'Reconstruye la escena de un delito informático a partir de los rastros.', 'visor', 'raro',       'aciertos',  40, null, 6),
  ('visor-bioetica',  'Lente Bioética',         'Pondera dignidad y autonomía donde la técnica avanza más rápido que la ley.', 'visor', 'epico',   'aciertos', 150, null, 7),

  -- TOGA --------------------------------------------------------------------
  ('toga-bioderecho', 'Toga de Bioderecho',     'Tejida para el terreno donde el derecho discute con la biología.',        'toga', 'raro',       'partidas',  15, null, 15),
  ('toga-cripto',     'Cota Criptográfica',     'Cada hilo es un bloque encadenado. Inalterable, como el registro.',       'toga', 'epico',      'nivel',      7, null, 16),

  -- INSTRUMENTO -------------------------------------------------------------
  ('inst-llave',      'Llave Criptográfica',    'Firma, cifra y prueba autoría sin revelar el secreto.',                    'instrumento', 'raro',  'partidas',  10, null, 25),
  ('inst-historia',   'Historia Clínica Digital','El dato más sensible que existe, y quién puede tocarlo.',                 'instrumento', 'epico', 'aciertos',  60, null, 26),
  ('inst-rastreador', 'Rastreador Forense',     'Sigue la huella que todos dejamos sin querer.',                            'instrumento', 'raro',  'nivel',      5, null, 27),

  -- COMPAÑERO ---------------------------------------------------------------
  ('comp-guardian',   'Guardián de Datos',      'Vigila qué sale de tu expediente y hacia dónde. Siete días de constancia.','companion', 'raro',   'racha',      7, null, 34),
  ('comp-oraculo',    'Oráculo Generativo',     'Propone, alucina y hay que controlarlo. Como toda IA generativa.',         'companion', 'legendario', 'racha',  14, null, 35),

  -- AURA --------------------------------------------------------------------
  ('aura-cadena',     'Cadena de Bloques',      'Cada partida que ganás queda encadenada a la anterior.',                   'aura', 'raro',       'partidas',  20, null, 44),
  ('aura-firma',      'Firma Digital',          'Tu rúbrica orbitando: nadie puede desconocer lo que firmaste.',            'aura', 'epico',      'nivel',      8, null, 45),
  ('aura-consenso',   'Consenso Distribuido',   'Doscientos aciertos. La red ya te da la razón por defecto.',               'aura', 'legendario', 'aciertos', 200, null, 46),

  -- ESCENARIO ---------------------------------------------------------------
  ('fondo-laboratorio','Laboratorio de Bioderecho','Donde se decide qué se puede hacer con lo que ya se puede hacer.',      'fondo', 'raro',       'partidas',  12, null, 55),
  ('fondo-forense',   'Sala Forense',           'Los rastros del delito, ordenados y listos para el juicio.',               'fondo', 'raro',       'aciertos',  50, null, 56),
  ('fondo-mercado',   'Mercado Cripto',         'Volatilidad en tiempo real. El derecho todavía corriendo atrás.',          'fondo', 'epico',      'nivel',      8, null, 57),
  ('fondo-panteon',   'Panteón de la Doctrina', 'Reservado a quien llegó al último escalón de la carrera.',                 'fondo', 'legendario', 'nivel',     12, null, 58)
on conflict (id) do nothing;

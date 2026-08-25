-- 007: copia del título de la clase en la sesión en vivo.
-- Los participantes anónimos por link NO tienen acceso de lectura a `classes`
-- (esa RLS exige estar inscripto o ser docente). Guardamos una foto del
-- título al crear la sesión para poder mostrarlo en /vivo/[code] sin RLS.
alter table live_sessions add column class_topic text;

update live_sessions ls set class_topic = c.topic
from classes c where c.id = ls.class_id and ls.class_topic is null;

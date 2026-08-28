-- 020: qué clases tienen mesa en la Biblioteca.
--
-- game_challenges no tiene policy de lectura para estudiantes a propósito —
-- tiene la respuesta correcta adentro (ver 014_juegos.sql). La Biblioteca sólo
-- necesita saber QUÉ CLASES tienen desafíos y CUÁNTOS, nunca el contenido, así
-- que se expone por una vista agregada sin las columnas sensibles.
--
-- Deliberadamente SIN security_invoker (mismo patrón que v_live_wordcloud en
-- 006_sesion_en_vivo.sql): corre con los privilegios de quien la crea, así
-- puede leer game_challenges aunque quien consulta la vista no tenga policy
-- sobre la tabla de base. El filtro de a quién le corresponde ver qué curso
-- se hace a mano adentro, con las mismas funciones que usan las policies.

create view v_game_tables as
select
  gc.course_id,
  gc.class_id,
  c.topic,
  c.class_date,
  count(*) as challenges
from game_challenges gc
join classes c on c.id = gc.class_id
where gc.class_id is not null
  and (auth_is_enrolled(gc.course_id) or auth_is_teacher_of(gc.course_id) or auth_role() = 'admin')
group by gc.course_id, gc.class_id, c.topic, c.class_date;

grant select on v_game_tables to authenticated;

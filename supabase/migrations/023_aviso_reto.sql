-- 023: un tipo de aviso para los retos entre estudiantes.
--
-- Los retos asincrónicos (021) se apoyan en que el rival juegue cuando pueda,
-- pero hasta acá no había forma de que se enterara de que lo retaron: el reto
-- sólo aparecía si entraba a Juegos de casualidad. Con esto entra al mismo
-- circuito que el resto de los avisos (campana + push).

alter type notification_kind add value if not exists 'reto';

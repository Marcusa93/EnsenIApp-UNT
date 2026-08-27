-- 010: cronograma real 2026 (Planificación Anual, cátedra Dr. Mario Leal).
-- Martes y jueves, 18:00–20:00, comisión vespertina única.
-- Las dos clases que ya existían (con grabaciones, disparadoras y debate
-- colgados) se actualizan a su fecha/tema real en vez de recrearse.
-- Los docentes invitados sin perfil en el campus van en el summary ("Dictan:").

-- Clase 1 (18/08) — era la "clase introductoria" sembrada: acá vive la
-- grabación de la clase inaugural del Dr. Leal.
update classes set
  class_date = '2026-08-18',
  topic = 'Clase 1 · Derecho de las Nuevas Tecnologías: concepto, técnica y derechos intelectuales',
  summary = E'Dictan: Dr. Mario Leal y Dr. Luis Alejandro Ontiveros.\n\nQué es el derecho de las nuevas tecnologías. La tecnología y la técnica; ciencia, tecnología y desarrollo. La producción del conocimiento y su protección: invenciones e innovaciones. Los problemas que la tecnología resuelve y los que genera; el papel del mercado. Derechos intelectuales autorales e industriales, su protección y registración. Efecto de la tecnología en los derechos humanos.',
  sort_order = 1
where id = 'e67fe16f-82a1-46a8-84e3-e9be29f3e01e';

-- Clase 3 (25/08) — ya existía con las disparadoras de la sesión en vivo y el debate.
update classes set
  class_date = '2026-08-25',
  topic = 'Clase 3 · Ciberdelincuencia: "Sr. Juez, el robo no fue real, solo virtual"',
  sort_order = 3
where id = '00000000-0000-0000-0000-000000000003';

insert into classes (course_id, class_date, topic, summary, sort_order) values
  ('00000000-0000-0000-0000-000000000002', '2026-08-20', 'Clase 2 · Tecnología y desarrollo económico. Economía virtual y criptomonedas', E'Dicta: C.P.N. Marcelo Albaca Petersen.\n\nTecnología y desarrollo económico: naciones de primera y de segunda. La economía virtual y las criptomonedas.', 2),
  ('00000000-0000-0000-0000-000000000002', '2026-08-27', 'Clase 4 · Imagen, intimidad y datos: habeas data, derecho al olvido y firma digital', E'Dictan: Dra. María Luz Sobrecasas y Dr. Benjamín Sobrecasas.\n\nLa era informática en relación a la imagen. Derechos de intimidad y redes sociales. Datos personales y datos sensibles; habeas data. El derecho al olvido y el borrado de datos en Internet. Documentos electrónicos, firma digital y contratos informáticos: lugar del cumplimiento. Protección de la propiedad de páginas web y la aplicación del derecho informático según los tribunales.', 4),
  ('00000000-0000-0000-0000-000000000002', '2026-09-01', 'Clase 5 · ¡Chau expediente de papel! ¡Hola expediente digital!', E'Dicta: Dr. Víctor Carlos.\n\nDel expediente de papel al expediente digital: qué cambia en la práctica profesional (y qué suerte para los bosques).', 5),
  ('00000000-0000-0000-0000-000000000002', '2026-09-03', 'Clase 6 · La Inteligencia Artificial: ¿un mundo donde los no humanos serán amos del universo?', E'Dicta: Ing. Lucas Abdala.', 6),
  ('00000000-0000-0000-0000-000000000002', '2026-09-08', 'Clase 7 · Periodismo, redes sociales y comunidades digitales. El caso de la Datita', E'Dicta: Matías Auad.', 7),
  ('00000000-0000-0000-0000-000000000002', '2026-09-10', 'Clase 8 · Realidad virtual y ampliada. Personalidad de inhumanos. Transferencia de tecnología', E'Dictan: Dra. Solana Casella y Dr. Mario Leal.\n\nRegulación de la realidad virtual y ampliada. Inteligencia artificial y personalidad de inhumanos. Redes, contratos de transferencia de tecnología y desarrollo tecnológico.', 8),
  ('00000000-0000-0000-0000-000000000002', '2026-09-15', 'Clase 9 · El mundo del trabajo y las nuevas tecnologías', E'Dicta: Dr. Franco Orellana.', 9),
  ('00000000-0000-0000-0000-000000000002', '2026-09-17', 'Clase 10 · Biotecnología: ¿de qué se trata?', E'Dicta: Lic. José María Álvarez.', 10),
  ('00000000-0000-0000-0000-000000000002', '2026-09-22', 'Clase 11 · Bioética y medicina para la longevidad: ¿una sociedad de humanos inmortales?', E'Dicta: Dra. Cristina Bazán.', 11),
  ('00000000-0000-0000-0000-000000000002', '2026-09-24', 'Clase 12 · La comunicación en la era de la IA. Caso New York Times vs. OpenAI', E'Dictan: Dr. Carlos Arias y Dr. Juan P. Flores.\n\nEl valor de la comunicación en la era de la inteligencia artificial: ¿quiénes manejan la información que consumimos?', 12),
  ('00000000-0000-0000-0000-000000000002', '2026-09-29', 'Clase 13 · Delitos informáticos a través de Internet. Modelos de contratos informáticos', E'Dicta: Dr. Cayetano Fernando Alberti.', 13),
  ('00000000-0000-0000-0000-000000000002', '2026-10-01', 'Clase 14 · Una ciudad inteligente: ¿mito, leyenda, realidad virtual o futuro posible?', E'Dicta: Dr. Luis Alfredo López.', 14),
  ('00000000-0000-0000-0000-000000000002', '2026-10-06', 'Clase 15 · Biotecnología humana, animal y vegetal. Genética y derechos de cuarta generación', E'Dicta: Dr. Ignacio Chasco Olazabal.\n\nBiotecnología: concepto y principios bioéticos. Biotecnología humana (genoma humano), animal y vegetal (producción transgénica y medio ambiente). Bioderechos, genética, derechos humanos de cuarta generación y daño genético.', 15),
  ('00000000-0000-0000-0000-000000000002', '2026-10-08', 'Clase 16 · El sistema SAE', E'Dictan: Dra. Luciana Eleas y Dr. Enzo Pautassi.', 16),
  ('00000000-0000-0000-0000-000000000002', '2026-10-13', 'Clase 17 · ¿Qué vamos a usar cuando no usemos más celulares? Metaverso, computación espacial, RV y RA', E'Dicta: Dr. Facundo Novillo.', 17),
  ('00000000-0000-0000-0000-000000000002', '2026-10-15', 'Clase 18 · Prompts con finalidad jurídica: metodología con IA generativa y ciberseguridad', E'Dictan: Dr. Marco Rossi y Dr. Franco Orellana.\n\nLa construcción de una metodología con herramientas de IA generativa. Prácticas de ciberseguridad en la era de la IA.', 18),
  ('00000000-0000-0000-0000-000000000002', '2026-10-20', 'Clase 19 · Prueba digital e IA generativa: ¿cómo probamos qué es verdad?', E'Dictan: Dr. Marco Rossi y Dr. Franco Orellana.', 19),
  ('00000000-0000-0000-0000-000000000002', '2026-10-22', 'Clase 20 · Generación de imágenes, videos y sonidos: fenómeno jurídico y herramienta profesional', E'Dictan: Dr. Marco Rossi y Dr. Franco Orellana.', 20),
  ('00000000-0000-0000-0000-000000000002', '2026-10-27', 'Clase 21 · La revolución que se viene: embodiment e ingreso básico universal', E'Dictan: Dr. Marco Rossi y Dr. Franco Orellana.', 21),
  ('00000000-0000-0000-0000-000000000002', '2026-10-29', 'Clase 22 · Investigaciones con IA generativa: deep research y NotebookLM', E'Dictan: Dr. Marco Rossi y Dr. Franco Orellana.', 22),
  ('00000000-0000-0000-0000-000000000002', '2026-11-03', 'Clase 23 · La era de la abogacía aumentada: ¿cómo se ejercerá la profesión en el futuro cercano?', E'Dictan: Dr. Marco Rossi y Dr. Franco Orellana.', 23),
  ('00000000-0000-0000-0000-000000000002', '2026-11-05', 'Clase 24 · Data governance', E'Dicta: Dr. Mario Leal.', 24),
  ('00000000-0000-0000-0000-000000000002', '2026-11-10', 'Clase 25 · Protección de datos personales', E'Dicta: Dr. Mario Leal.', 25),
  ('00000000-0000-0000-0000-000000000002', '2026-11-12', 'Clase 26 · Sistema Lex 100', E'Dicta: Dr. Mario Leal.', 26),
  ('00000000-0000-0000-0000-000000000002', '2026-11-17', 'Clase 27 · Desarrollo del trabajo final', E'Dicta: Dr. Mario Leal.', 27),
  ('00000000-0000-0000-0000-000000000002', '2026-11-19', 'Clase 28 · Desarrollo del trabajo final (continuación)', E'Dicta: Dr. Mario Leal.', 28),
  ('00000000-0000-0000-0000-000000000002', '2026-11-26', 'Clase 29 · Presentación de trabajos finales', E'Preside: Decana de la Facultad.', 29),
  ('00000000-0000-0000-0000-000000000002', '2026-12-02', 'Clase 30 · Entrega de notas y cierre', E'Toda la cátedra.', 30);

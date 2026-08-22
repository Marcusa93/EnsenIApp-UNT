-- Seed: materia, curso 2026 y cronograma de la clase introductoria
insert into subjects (id, name, description) values (
  '00000000-0000-0000-0000-000000000001',
  'Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI',
  'Materia optativa que explora, desde una mirada jurídica y prospectiva, los grandes desafíos que la tecnología y las ciencias de la vida le plantean al derecho actual. Un primer eje recorre el derecho de las nuevas tecnologías: derechos intelectuales, economía virtual y criptomonedas, ciberdelincuencia, protección de datos personales, derecho al olvido, firma digital, contratos informáticos e inteligencia artificial generativa. El segundo eje es el bioderecho: biotecnología humana, animal y vegetal, bioética, medicina de la longevidad y derechos humanos de cuarta generación frente al avance de la genética.'
) on conflict (id) do nothing;

insert into courses (id, subject_id, name, term) values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Comisión única',
  '2026'
) on conflict (id) do nothing;

insert into classes (course_id, class_date, topic, summary, sort_order) values (
  '00000000-0000-0000-0000-000000000002',
  current_date,
  'Clase introductoria: presentación de la materia',
  'La asistencia a clase no es un trámite: es la llave del régimen especial de promoción de esta materia. Sostener la asistencia a lo largo del semestre habilita a promocionar sin rendir examen final.',
  1
);

-- Cuerpo docente
insert into faculty (subject_id, full_name, position, rank) values
  ('00000000-0000-0000-0000-000000000001', 'Dr. Mario Rodolfo Leal', 'Profesor Titular', 1),
  ('00000000-0000-0000-0000-000000000001', 'Luis Alejandro Ontiveros', 'Profesor Asociado', 2),
  ('00000000-0000-0000-0000-000000000001', 'Luis Alfredo López', 'Profesor Asociado', 2),
  ('00000000-0000-0000-0000-000000000001', 'Cayetano Fernando Gabriel Alberti', 'Profesor Adjunto', 3),
  ('00000000-0000-0000-0000-000000000001', 'Ignacio Chasco Olazabal', 'Profesor Adjunto', 3),
  ('00000000-0000-0000-0000-000000000001', 'Víctor Carlos', 'Profesor Adjunto', 3),
  ('00000000-0000-0000-0000-000000000001', 'María Falú', 'Profesora Adjunta', 3),
  ('00000000-0000-0000-0000-000000000001', 'Solana Esther Casella', 'Jefa de Trabajos Prácticos', 4),
  ('00000000-0000-0000-0000-000000000001', 'Franco Javier Orellana', 'Docente Auxiliar', 5),
  ('00000000-0000-0000-0000-000000000001', 'Marco Rossi', 'Docente Auxiliar', 5),
  ('00000000-0000-0000-0000-000000000001', 'Carlos Enrique Arias', 'Aspirante Graduado', 6),
  ('00000000-0000-0000-0000-000000000001', 'Luciana Eleas', 'Aspirante Graduada', 6),
  ('00000000-0000-0000-0000-000000000001', 'Enzo Pautasi', 'Aspirante Graduado', 6),
  ('00000000-0000-0000-0000-000000000001', 'Gimena Santiago Buffo', 'Aspirante Graduada', 6),
  ('00000000-0000-0000-0000-000000000001', 'Juan Pablo Flores', 'Aspirante Graduado', 6),
  ('00000000-0000-0000-0000-000000000001', 'Isaías Lisandro Nadal Saifán', 'Aspirante Estudiante', 7);

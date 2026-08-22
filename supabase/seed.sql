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

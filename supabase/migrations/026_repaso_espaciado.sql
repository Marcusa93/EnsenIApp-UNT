-- 026: repaso espaciado — que no aparezcan siempre las mismas.
--
-- Hasta acá la ronda se armaba barajando el banco y cortando las primeras 5.
-- Con 6 preguntas por clase y juego, eso significa ver casi las mismas siempre;
-- y peor: lo que fallaste no vuelve, y lo que ya sabés reaparece igual.
--
-- Acá se guarda, por estudiante y por pregunta, cómo le fue y cuándo conviene
-- volver a mostrársela. La regla es la de siempre en repaso espaciado: si
-- acertás, la pregunta se va espaciando (1, 3, 7, 16, 35 días); si fallás,
-- vuelve enseguida y arranca de nuevo.
--
-- Esto es lo que convierte los juegos de "gamificación" (que sube el uso pero
-- poco el aprendizaje) en práctica de recuperación espaciada, que es la
-- intervención con mejor evidencia en psicología del aprendizaje. La mecánica
-- de juego pasa a cumplir el rol que sí tiene bien probado: que la práctica se
-- sostenga en el tiempo.

create table challenge_reviews (
  student_id uuid not null references profiles(id) on delete cascade,
  challenge_id uuid not null references game_challenges(id) on delete cascade,
  /** Cuántas veces se la mostramos. */
  seen int not null default 0,
  /** Aciertos seguidos: define cuánto se espacia la próxima. Un error lo vuelve a 0. */
  correct_streak int not null default 0,
  last_seen_at timestamptz not null default now(),
  /** Desde cuándo conviene volver a preguntarla. */
  due_at timestamptz not null default now(),
  primary key (student_id, challenge_id)
);

-- El índice que importa: "qué le toca repasar a esta persona".
create index challenge_reviews_due_idx on challenge_reviews (student_id, due_at);

alter table challenge_reviews enable row level security;

-- El estudiante puede ver su propio historial de repaso; escribir lo hace el
-- servidor al corregir, igual que game_runs.
create policy "challenge_reviews: propias" on challenge_reviews
  for select using (student_id = auth.uid());
create policy "challenge_reviews: docente lee" on challenge_reviews
  for select using (
    exists (
      select 1 from game_challenges gc
      where gc.id = challenge_reviews.challenge_id
        and (auth_is_teacher_of(gc.course_id) or auth_role() = 'admin')
    )
  );

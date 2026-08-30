-- 025: consentimiento informado para el uso de los datos con fines de investigación.
--
-- El campus ya venía registrando actividad (usage_events, check-ins, partidas,
-- consultas) sin que nadie hubiera dicho que sí a que eso se use para
-- investigar. Acá queda el registro de esa decisión.
--
-- Dos definiciones que importan:
--
-- 1. El consentimiento gobierna el USO DE INVESTIGACIÓN, no el funcionamiento
--    del campus. Quien no acepta usa todo igual: sus datos siguen sirviendo
--    para que su docente lo acompañe (que es la finalidad original y necesaria
--    del sistema), pero quedan afuera de cualquier análisis, publicación o
--    export del estudio. Si aceptar fuera condición para usar la plataforma, el
--    consentimiento no sería libre — y menos todavía dado que quien investiga
--    es el mismo docente que evalúa.
--
-- 2. Se guarda la decisión, sea sí o no, para no volver a preguntar. Insistir
--    con el cartel a quien ya dijo que no es una forma de presión.
--
-- La versión del texto se guarda con la decisión: si el consentimiento cambia,
-- se vuelve a pedir para esa versión nueva y no se asume el sí anterior.

create table research_consent (
  user_id uuid primary key references profiles(id) on delete cascade,
  /** Versión del texto que la persona efectivamente leyó. */
  version text not null,
  accepted boolean not null,
  decided_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_consent_version_idx on research_consent (version, accepted);

alter table research_consent enable row level security;

-- Cada uno ve y decide lo suyo. Se permite update para poder cambiar de opinión
-- (retirar el consentimiento es un derecho, no una excepción).
create policy "research_consent: propio" on research_consent
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- El equipo de investigación necesita saber QUIÉNES quedan dentro del estudio,
-- no hace falta más que eso.
create policy "research_consent: admin lee" on research_consent
  for select using (auth_role() = 'admin');

create trigger trg_research_consent_updated
  before update on research_consent
  for each row execute function set_updated_at();

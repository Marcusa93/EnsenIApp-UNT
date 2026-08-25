# EnsenIA UNT — Arquitectura y contrato de desarrollo

Campus digital de la materia **"Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI"**
(Abogacía, Facultad de Derecho, Universidad Nacional de Tucumán). Idioma de la UI: **español rioplatense** (voseo: "ingresá", "marcá").

## 1. Propósito del producto

Las clases se **graban**. El campus las **procesa con IA** para que el estudiante tenga:
resumen, **placas interactivas** (flashcards / quiz / conceptos), versión en **lenguaje simple**,
transcripción navegable y **feedback personalizado**. A la vez, el campus **recoge información del
estudiante** (qué le cuesta, consultas, encuestas, telemetría de uso) y el equipo docente puede
pedir **informes a demanda** generados con IA sobre esos datos para mejorar la cursada.

Lógica docente (tomada de ensenIA-smt): el docente crea **actividades** (borrador → publicada → cerrada),
las **asigna** a todos o a estudiantes seleccionados, ve **entregas**, corrige con feedback sugerido por IA,
gestiona el **padrón**, recibe **alertas automáticas** (dificultad reiterada, bajo desempeño) y puede
**consultar** a los estudiantes con encuestas rápidas (polls).
**Uso sin datos**: PWA offline-first — lectura cacheada + cola de escrituras en localStorage que se
vacía al recuperar conexión.

Modelo de debate (tomado de UrbanIA): **debates** ligados a una clase/grabación, argumentos con
postura (a favor / en contra / neutral), hilos, apoyos (toggle 1 por usuario), moderación docente,
y **síntesis con IA** al cierre.

## 2. Stack

- **Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto, Tailwind v4** (tokens en `src/app/globals.css`).
- **Supabase**: Postgres + RLS, Auth (Google OAuth + magic link), Storage (buckets privados `class-recordings`, `class-materials`), Realtime.
- **OpenRouter** (OpenAI-compatible) para LLM y transcripción. Cliente en `src/lib/openrouter.ts`.
- **Vercel** (Fluid Compute, Node 24). Timeout de función: **300 s** → el pipeline es **por pasos** (ver §6).
- Librerías instaladas: `@supabase/ssr`, `@supabase/supabase-js`, `openai`, `zod`, `date-fns`, `lucide-react`,
  `motion` (framer-motion v12+ API: `import { motion } from "motion/react"`), `react-markdown` + `remark-gfm`,
  `clsx` + `tailwind-merge`, `papaparse`, `recharts`.
  **No instalar paquetes nuevos sin necesidad real**; si hace falta, `npm install <pkg>` y documentarlo en el reporte final.

## 3. Roles y acceso

`user_role = estudiante | docente | admin`. `profiles.status = pendiente | validado | bloqueado`.

- **Estudiante**: entra con Google o email institucional (magic link). Si su email está en el `roster` (padrón) queda
  `validado` y auto-inscripto en el curso; si no, entra como `pendiente` (puede usar el campus, pero el docente lo ve marcado para revisar).
- **Docente**: ve/edita sólo los cursos donde está en `teacher_assignments`. Helpers SQL: `auth_role()`, `auth_is_teacher_of(course_id)`, `auth_is_enrolled(course_id)`, `auth_can_see_activity(activity_id)`.
- **Admin**: todo. Gestiona roles, cursos, asignación de docentes, cuerpo docente.

**Regla de oro**: en Server Components / Server Actions / Route Handlers usar **`createClient()` de `src/lib/supabase/server.ts`**
(respeta RLS). **`createAdminClient()`** (`src/lib/supabase/admin.ts`, service role) sólo en procesos de fondo
(pipeline de IA, informes) y **siempre después de verificar manualmente** que el usuario tiene permiso sobre el recurso.
Nunca importar `admin.ts` desde un componente cliente.

## 4. Esquema de datos (resumen; fuente de verdad: `supabase/migrations/*.sql` y `src/lib/types/database.ts`)

| Dominio | Tablas |
|---|---|
| Identidad | `profiles`, `roster` (padrón), `faculty` (cuerpo docente público) |
| Cursada | `subjects`, `courses` (enrollment_code), `teacher_assignments`, `enrollments`, `classes` (cronograma: fecha, tema, docente, resumen), `announcements`, `class_materials` |
| Grabaciones + IA | `class_recordings` (status, progress, current_step, chunks_total/done, published), `recording_chunks`, `transcripts` (full_text, segments[]), `class_summaries` (summary_md, key_points[], sections[], glossary[]), `interactive_cards` (cards[]), `simplified_content` (level facil/intermedio), `ai_feedback` (por estudiante) |
| Lógica docente | `activities` (type lectura/cuestionario/placas/entrega/debate/encuesta; status draft/published/closed; target todos/seleccionados; content jsonb), `activity_assignments`, `activity_submissions` (answers jsonb, auto_score, score, teacher_feedback_md, ai_feedback_md, status) |
| Voz del estudiante | `student_checkins` (difficulty 1-5 + comentario por clase), `student_questions` (consultas; ai_answer_md, teacher_answer_md, status), `polls` + `poll_responses`, `card_progress` |
| Debate | `debates`, `debate_arguments` (stance, parent_id, status visible/hidden), `debate_supports` |
| Seguimiento | `usage_events` (telemetría; ver taxonomía en `src/lib/types/helpers.ts`), `teacher_alerts` (triggers automáticos), `report_requests` (informes a demanda: scope, filters, result_md) |
| Notificaciones | `notifications` (bandeja in-app), `notification_preferences`, `notification_deliveries`, `notification_campaigns`, `push_subscriptions` — esquema listo (004) con RLS; la UI/envíos son un módulo futuro |
| Vistas | `v_course_engagement`, `v_recording_status` (incluye `error_message` desde 004) |

Tipos: `import type { Tables, Enums } from "@/lib/types/helpers"` → `Tables<"activities">`. Los JSONB llegan como `Json`;
castear en el borde con las interfaces de `helpers.ts` (`InteractiveCardItem[]`, `TranscriptSegment[]`, etc.).

Migraciones aplicadas: `001_init` → `004_integration` (esta última consolidó los pendientes de la fase
paralela: constraints del pipeline, policies de storage para entregas y borrado, visibilidad de perfiles
docentes, esquema de notificaciones, delete de informes, realtime de `debate_supports` y unicidad de
check-ins). Cambios de esquema nuevos: `supabase/migrations/NNN_*.sql` + `scripts/db.sh` + `scripts/gen-types.sh`.

## 5. Mapa de rutas (única fuente de verdad: `src/lib/nav.ts`)

```
/                         landing pública (materia, ejes, cuerpo docente, CTA)
/login                    Google + magic link institucional
/auth/callback, /auth/signout
/campus                   redirige según rol (homeForRole)

/campus/estudiante                          Hoy: próxima clase, avisos, actividades pendientes, check-in, último feedback IA
/campus/estudiante/clases                   cronograma
/campus/estudiante/clases/[classId]         clase: grabaciones publicadas → resumen, placas, versión simple, transcripción, materiales, preguntar
/campus/estudiante/placas/[recordingId]     modo placas interactivas inmersivo (flashcards + quiz) con progreso
/campus/estudiante/actividades              lista (pendientes / entregadas)
/campus/estudiante/actividades/[activityId] realizar / entregar (autosave, eventos)
/campus/estudiante/consultas                mis consultas (respuesta IA inmediata + respuesta docente), preguntar
/campus/estudiante/progreso                 mi progreso + "generar mi devolución" (ai_feedback)
/campus/debates, /campus/debates/[debateId] compartido por roles

/campus/docente                             panel: KPIs, alertas, próximas clases, consultas abiertas, pipeline en curso
/campus/docente/clases                      cronograma CRUD + avisos
/campus/docente/clases/[classId]            clase: materiales, grabaciones (subir → progreso realtime → publicar), generar actividad/debate desde grabación
/campus/docente/actividades                 lista por estado
/campus/docente/actividades/nueva           crear (asistido por IA desde una grabación) + asignar
/campus/docente/actividades/[activityId]    editar, asignar, publicar/cerrar, entregas, corregir (feedback IA sugerido)
/campus/docente/estudiantes                 padrón (CSV), inscriptos, pendientes de validación
/campus/docente/estudiantes/[studentId]     ficha: uso, dificultades, entregas, consultas, feedback
/campus/docente/consultas                   responder consultas; encuestas (crear/abrir/cerrar/resultados)
/campus/docente/informes                    pedir informe (scope + filtros) → lista → ver informe
/campus/docente/informes/[reportId]
/campus/admin                               usuarios/roles, cursos, docentes por curso, cuerpo docente

/api/recordings/[recordingId]/step   POST — avanza un paso del pipeline (ver §6)
/api/questions/[questionId]/answer   POST — respuesta IA a una consulta
/api/feedback/generate               POST — feedback personalizado del estudiante autenticado
/api/reports/[reportId]/generate     POST — genera informe
/api/debates/[debateId]/synthesize   POST — síntesis IA del debate
/api/activities/suggest              POST — IA sugiere actividad desde transcripción
/api/submissions/[id]/ai-feedback    POST — feedback IA sugerido para corrección
```

## 6. Pipeline de grabación (resumible, por pasos)

1. **Navegador** (`src/lib/audio/`): decodifica el archivo con Web Audio (`decodeAudioData`), downmix mono, resample 16 kHz
   (`OfflineAudioContext`), codifica MP3 32 kbps con `@breezystack/lamejs` en un **Web Worker**, parte en chunks de ≤ 10 min.
   Sube cada chunk a `class-recordings/{recordingId}/chunk-{i}.mp3` y crea `recording_chunks`. Esto reduce ~90 % el peso subido.
2. **`POST /api/recordings/[id]/step`** avanza **un** paso y responde `{ status, progress, current_step, done }`. El cliente lo llama en bucle
   (y muestra progreso por Realtime de `class_recordings`). Pasos:
   `uploaded → transcribing` (un chunk por request; offsets sumados) `→ processing` (compila `transcripts`) `→ generating`
   (sub-pasos: summary → cards → simplified_facil → simplified_intermedio) `→ ready`. Cualquier error: `status='error'`, `error_message`, log en `processing_log`; el paso es **idempotente y reintentable**.
3. **Transcripción** (`src/lib/ai/transcribe.ts`): primario `openrouter.audio.transcriptions.create({ model: "openai/whisper-1", response_format: "verbose_json", language: "es" })`
   (el endpoint existe en OpenRouter); fallback automático si falla: chat completion a `google/gemini-3.7-flash` con `input_audio` base64
   pidiendo JSON `{segments:[{start,end,text}]}`. Ambos detrás de una interfaz común que devuelve `TranscriptSegment[]`.
4. **Generación** (`src/lib/ai/generate.ts`): prompts en español, salida JSON validada con **zod**; extraer JSON de forma robusta (`src/lib/ai/json.ts`) aunque el modelo envuelva en ```json.
   Modelos (`src/lib/openrouter.ts`): `reasoning = anthropic/claude-sonnet-5`, `fast = anthropic/claude-haiku-4.5`, `audio = google/gemini-3.7-flash`.
   Overridables por env `OPENROUTER_MODEL_REASONING`, `OPENROUTER_MODEL_FAST`.
5. El docente **publica** (`class_recordings.published = true`) cuando revisó; hasta entonces el estudiante no la ve (RLS).

## 7. Diseño — "campus tech, innovador, dinámico"

- **Dark-first** con soporte light (tokens ya definidos en `globals.css`: `--background`, `--surface`, `--surface-2`, `--foreground`, `--muted`, `--border`, `--accent` violeta, `--accent-2` cian, `--accent-3` rosa). Usar clases Tailwind `bg-surface`, `text-muted`, `border-border`, `text-accent-2`, etc.
- Tipografía: **Space Grotesk** (UI) + **JetBrains Mono** (etiquetas, códigos, timestamps; clase `.font-mono`).
- Lenguaje visual: etiquetas mono en mayúsculas con tracking (`font-mono text-xs uppercase tracking-widest`), grilla sutil `.campus-grid`,
  bordes 1px, radios `rounded-2xl`, `glow` en la acción principal, gradientes de acento en títulos hero, micro-animaciones con `motion` (entrada escalonada, progreso), estados vacíos con mensaje útil.
- Primitivas compartidas en `src/components/ui/` (Button, Card, Badge, Input, Textarea, Select, Tabs, Dialog, Progress, Skeleton, EmptyState, PageHeader, Stat, Markdown). **Usarlas; no reinventar.** `cn()` en `src/lib/utils.ts`.
- Mobile-first: el estudiante usa el celular. Navegación inferior en mobile, sidebar en desktop.
- Accesibilidad: labels, foco visible, contraste AA, `aria-*` en componentes interactivos.

## 8. Convenciones de código

- Server Components por defecto; `"use client"` sólo donde hay interactividad. Mutaciones via **Server Actions** (`actions.ts` junto a la ruta, con `"use server"`, validación **zod**, `revalidatePath`) o Route Handlers para procesos IA.
- Archivos: `page.tsx`, `actions.ts`, `loading.tsx` cuando hay fetch lento, componentes locales en `_components/` dentro de la ruta.
- Lib compartida: `src/lib/supabase/*`, `src/lib/openrouter.ts`, `src/lib/ai/*`, `src/lib/telemetry/*` (cliente: `track(event, payload)` con cola offline), `src/lib/utils.ts`.
- Errores: nunca tragar; `console.error` con contexto + mensaje útil al usuario. Sin `any` (usar `unknown` + narrowing).
- Fechas: `date-fns` con locale `es`. Zona horaria: America/Argentina/Tucuman.
- Nombres en español para UI y dominio; código en inglés.
- Verificación obligatoria antes de reportar: `npx tsc --noEmit` y `npm run lint` sin errores en los archivos propios.

## 9. Comandos

```bash
npm run dev                 # http://localhost:3000
npx tsc --noEmit            # typecheck
npm run lint                # eslint
scripts/db.sh <file.sql>    # ejecutar SQL en Supabase (sólo fase de integración)
scripts/db.sh -q "select 1" # query inline
scripts/gen-types.sh        # regenerar src/lib/types/database.ts
```

Variables (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`.

## 10. Propiedad de archivos en la fase paralela

> La fase paralela terminó: la integración (migración `004_integration`) consolidó los pendientes y el
> cableado cruzado. La regla queda como referencia para futuras rondas de desarrollo en paralelo.

Cada módulo **sólo** crea/edita archivos dentro de sus directorios asignados. Archivos compartidos (`globals.css`, `layout.tsx`,
`src/components/ui/*`, `src/lib/nav.ts`, `src/lib/types/*`, `src/lib/supabase/*`, `src/lib/openrouter.ts`, `middleware.ts`) son de la
**fundación**; si un módulo necesita un cambio ahí, lo describe en su reporte final en vez de editarlo.

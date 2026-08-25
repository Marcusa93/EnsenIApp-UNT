# EnsenIA UNT

Campus digital con IA para **"Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI"**
(Abogacía, Facultad de Derecho, Universidad Nacional de Tucumán).

Las clases se graban y el campus las procesa con IA: resumen, placas interactivas
(flashcards / quiz), versión en lenguaje simple, transcripción navegable y feedback
personalizado por estudiante. El equipo docente gestiona cronograma, actividades,
padrón, consultas, encuestas, debates e informes a demanda generados con IA.

**Documentación de arquitectura:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
**PWA/offline:** [`docs/PWA.md`](docs/PWA.md)

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript estricto, Tailwind v4.
- **Supabase**: Postgres + RLS, Auth (Google OAuth + magic link), Storage, Realtime.
- **OpenRouter** (API OpenAI-compatible) para LLM y transcripción.
- **Vercel** (Fluid Compute, Node 24) para hosting y funciones.
- PWA offline-first: service worker propio (`public/sw.js`) + cola de escrituras en localStorage.

## Setup local

```bash
git clone <repo>
cd EnsenIApp-UNT
npm install
cp .env.example .env.local   # o crear .env.local a mano (ver abajo)
npm run dev                  # http://localhost:3000
```

### Variables de entorno (`.env.local`)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (cliente, respeta RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (sólo server, procesos de fondo) |
| `OPENROUTER_API_KEY` | API key de OpenRouter |
| `SUPABASE_PROJECT_REF` | Ref del proyecto (para `scripts/db.sh` y `gen-types.sh`) |
| `SUPABASE_ACCESS_TOKEN` | Token personal de la Management API de Supabase |
| `OPENROUTER_MODEL_REASONING` | (opcional) override del modelo de razonamiento |
| `OPENROUTER_MODEL_FAST` | (opcional) override del modelo rápido |
| `NEXT_PUBLIC_PWA_DEV` | (opcional) `1` para probar el service worker en dev |

### Base de datos

Las migraciones viven en `supabase/migrations/NNN_*.sql` y se aplican en orden con:

```bash
scripts/db.sh supabase/migrations/001_init.sql
scripts/db.sh supabase/migrations/002_campus_core.sql
scripts/db.sh supabase/migrations/003_recording_chunks.sql
scripts/db.sh supabase/migrations/004_integration.sql
scripts/gen-types.sh   # regenera src/lib/types/database.ts desde el esquema real
```

`scripts/db.sh -q "select ..."` ejecuta una query inline (útil para inspección).
Nunca editar `src/lib/types/database.ts` a mano.

Crear además los buckets **privados** de Storage `class-recordings` y `class-materials`
(Dashboard → Storage → New bucket, sin acceso público): las policies de acceso ya
vienen en las migraciones.

## Scripts

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run lint           # eslint
npx tsc --noEmit       # typecheck estricto
scripts/db.sh <sql>    # ejecutar SQL contra Supabase (Management API)
scripts/gen-types.sh   # regenerar tipos de la DB
scripts/push.sh [rama] # push al repo con la cuenta gh correcta
```

## Configurar Google OAuth en Supabase

1. En [Google Cloud Console](https://console.cloud.google.com) → *APIs & Services → Credentials*:
   crear un **OAuth client ID** (tipo *Web application*).
   - *Authorized JavaScript origins*: `https://<tu-dominio>` y `http://localhost:3000`.
   - *Authorized redirect URIs*: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. En el Dashboard de Supabase → *Authentication → Providers → Google*: pegar
   **Client ID** y **Client Secret** y habilitar el provider.
3. En *Authentication → URL Configuration*: setear **Site URL** al dominio de producción
   y agregar `http://localhost:3000/**` y `https://<tu-dominio>/**` a **Redirect URLs**
   (el flujo vuelve a `/auth/callback`).
4. El **magic link institucional** usa el provider de email (habilitado por defecto);
   personalizar la plantilla en *Authentication → Email Templates* si se desea.

Al ingresar, si el email del estudiante está en el `roster` (padrón) queda `validado`
y auto-inscripto; si no, entra como `pendiente` y el docente lo revisa en
*Estudiantes → Pendientes*.

## Deploy en Vercel

1. Importar el repo en Vercel (framework autodetectado: Next.js).
2. Cargar en *Settings → Environment Variables* todas las variables de `.env.local`
   (las `SUPABASE_*` de Management API sólo hacen falta si se corren los scripts desde CI;
   para runtime alcanzan las tres de Supabase + `OPENROUTER_API_KEY`).
3. El pipeline de IA usa funciones con `maxDuration` de hasta 300 s: requiere un plan
   con **Fluid Compute** habilitado (default en planes actuales).
4. Tras el primer deploy, actualizar la **Site URL** y las **Redirect URLs** de Supabase
   con el dominio final.
5. PWA: `public/sw.js` versiona el shell cacheado con la constante `VERSION`; subirla
   cuando cambie el HTML de `/` o `/login` (ver `docs/PWA.md`).

## Pipeline de grabaciones (resumen)

1. **Navegador**: decodifica el audio/video, downmix mono + resample 16 kHz, codifica
   MP3 32 kbps en un Web Worker y sube chunks de ≤ 10 min a `class-recordings`
   (~90 % menos de peso subido).
2. **`POST /api/recordings/[id]/step`** avanza un paso por request (respetando el
   timeout serverless) con progreso en vivo por Realtime:
   `uploaded → transcribing → processing → generating → ready`.
   Cada paso es idempotente y reintentable; los errores quedan en `error_message`
   y `processing_log`.
3. **Transcripción**: Whisper vía OpenRouter con fallback automático a un modelo
   multimodal con `input_audio`. **Generación**: resumen, placas interactivas y
   versiones en lenguaje simple, con prompts en español y salida JSON validada con zod.
4. El docente revisa la **vista previa** y **publica**; recién ahí la ve el estudiante (RLS).

## Estructura

```
src/app                 rutas (App Router) — ver mapa completo en docs/ARCHITECTURE.md §5
src/components          ui/ (primitivas), shell/, recordings/, cards/, debates/, ...
src/lib                 supabase/, ai/, audio/, telemetry/, reports/, types/
supabase/migrations     001_init → 004_integration (fuente de verdad del esquema)
scripts                 db.sh, gen-types.sh, push.sh
public                  sw.js, icons/, manifest (src/app/manifest.ts)
```

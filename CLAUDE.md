# EnsenIA UNT

Campus digital con IA para "Derecho de las Nuevas Tecnologías y Bioderecho" (Facultad de Derecho, UNT).

**Leer primero:** `docs/ARCHITECTURE.md` — contrato de rutas, esquema, pipeline de IA, diseño y convenciones.

- Stack: Next.js 16 App Router + Supabase (RLS) + OpenRouter + Vercel. UI en español rioplatense.
- Tipos DB generados: `src/lib/types/database.ts` (regenerar con `scripts/gen-types.sh`, nunca editar a mano). Helpers en `src/lib/types/helpers.ts`.
- Supabase server client (`src/lib/supabase/server.ts`) respeta RLS; `admin.ts` sólo para procesos de fondo tras verificar permisos.
- Verificar con `npx tsc --noEmit` y `npm run lint` antes de dar por terminado un cambio.
- Migraciones en `supabase/migrations/NNN_*.sql`, aplicadas con `scripts/db.sh`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PWA y uso sin datos

EnsenIA UNT es una Progressive Web App **offline-first para lectura**: lo que el estudiante ya abrió con conexión
sigue disponible sin red, y lo que hace sin red (progreso de placas, check-ins, telemetría) se **encola en el
dispositivo** y se envía solo cuando vuelve la conexión.

## Piezas

| Archivo | Rol |
|---|---|
| `src/app/manifest.ts` | Web App Manifest (`/manifest.webmanifest`): nombre, `display: standalone`, colores de la paleta, íconos, atajos. |
| `public/icons/*` | Íconos PNG 192/512 (`any` + `maskable`), `apple-touch-icon.png` (180) y SVG. |
| `public/sw.js` | Service worker escrito a mano, sin librerías. Versionado por `VERSION`. |
| `src/components/pwa/pwa-register.tsx` | `<PwaRegister/>` registra el SW, detecta nuevas versiones (toast "Nueva versión disponible — Actualizar") y captura `beforeinstallprompt`. Exporta `<InstallPrompt/>` y `useInstallPrompt()`. |
| `src/components/shell/offline-banner.tsx` | Barra "Sin conexión · N cambios pendientes" / "Sincronizando…" / "Todo sincronizado" con botón **Reintentar**; debajo monta `<InstallPrompt variant="bar"/>`. |
| `src/app/offline/page.tsx` | Fallback estático de navegación cuando no hay red ni copia cacheada. Vuelve solo cuando regresa la conexión. |
| `src/lib/telemetry/offline-queue.ts` | Cola de escrituras en `localStorage` (`ensenia.offline-queue`). |
| `src/app/layout.tsx` | `metadata.manifest`, `appleWebApp`, `themeColor` y monta `<PwaRegister/>`. |

## Cuándo se activa el service worker

- **Producción**: siempre (`NODE_ENV=production`).
- **Desarrollo**: sólo con `NEXT_PUBLIC_PWA_DEV=1`. Sin el flag, `<PwaRegister/>` **desregistra** cualquier SW previo para
  que el HMR no sirva caches viejos.

`/sw.js` vive en la raíz de `public/`, por lo que su scope es `/` sin necesidad del header `Service-Worker-Allowed`.

## Qué se cachea (y cómo)

Tres caches versionados (`ensenia-shell-<v>`, `ensenia-data-<v>`, `ensenia-assets-<v>`) más `ensenia-meta` (config persistida).
En `activate` se borran los caches de versiones anteriores; el SW hace `skipWaiting` + `clients.claim`.

| Petición | Estrategia | Cache | Detalle |
|---|---|---|---|
| App shell: `/`, `/login`, `/offline`, manifest, íconos | Precache en `install` | shell | Se descartan respuestas redirigidas (p. ej. `/login` → `/campus` con sesión). |
| Navegaciones (`mode: navigate`, mismo origen) | **NetworkFirst, timeout 4 s** → copia cacheada de esa ruta → `/offline` | shell | Usa navigation preload. Cada página visitada queda disponible offline. |
| `GET <SUPABASE_URL>/rest/v1/*` | **NetworkFirst, timeout 4 s** → copia cacheada | data | Máx. 300 entradas. Las respuestas servidas desde cache llevan el header `X-EnsenIA-Cache: offline`. |
| `/_next/static/*`, `/icons/*`, fuentes (incl. Google Fonts) | **CacheFirst** | assets | Máx. 120 entradas. |
| Storage `.../storage/v1/object/*` (signed URLs) | **CacheFirst** | assets | Sólo si no es audio/video y pesa ≤ 5 MB. El bucket `class-recordings` **nunca** se cachea. |

El origen de Supabase llega al SW por `postMessage({ type: "CONFIG", supabaseOrigin })` desde `<PwaRegister/>` (tomado de
`NEXT_PUBLIC_SUPABASE_URL`) y se persiste en `ensenia-meta`; si aún no llegó, se usa el sufijo `.supabase.co` como heurística.

### Lo que el SW **nunca** intercepta

- Cualquier método que no sea `GET` (POST/PUT/PATCH/DELETE).
- `/api/*` (pipeline de IA, informes, feedback), `/auth/*`, `/sw.js`, `/_next/data/*`, `/_next/image`.
- Fetches internos del App Router (`RSC: 1`, `Next-Router-Prefetch: 1`, `?_rsc=`): si fallan, Next hace navegación dura y ahí sí entra el fallback.
- Supabase `auth/v1`, `realtime/v1`, `functions/v1`.

Al hacer `POST /auth/signout` el SW (sin interceptar la petición) vacía el cache de datos y las páginas navegadas, dejando sólo el shell precacheado.
La página puede pedir lo mismo con `postMessage({ type: "CLEAR_DATA" })`.

## Qué se encola

Todo lo que pasa por `src/lib/telemetry`:

- `track(event, …)` → `usage_events` (telemetría de uso, `page_view`, `card_flipped`, `focus_lost`…).
- Cualquier módulo que use `enqueue({ table, op: "insert" | "upsert", payload, key?, onConflict? })` — p. ej. `card_progress`,
  `student_checkins`, respuestas parciales de actividades. `key` compacta (último gana) para no acumular duplicados.

Reglas de la cola:

- Capacidad **500 ítems**; compactación por `table + key`.
- `flush()` corre al recuperar conexión, cada 30 s y al montar el shell (`ensureAutoFlush()` es idempotente).
- Errores **permanentes** (RLS, esquema) se descartan con `console.error`; errores de **red** se reintentan hasta 5 veces.
- `OfflineBanner` muestra `getQueueSize()` en vivo (`subscribeQueue`) y ofrece **Reintentar** si el flush dejó ítems.

## Límites (por diseño)

- **No se cachea el audio completo de las clases** ni ningún audio/video: pesa demasiado y consume datos. Sin conexión se
  puede leer el **resumen, la versión simple, la transcripción y las placas** de las grabaciones que ya se abrieron.
- Sólo queda disponible offline lo **ya visitado**: no hay descarga anticipada del campus entero.
- Las **mutaciones** (entregar una actividad, publicar un argumento, responder una consulta) son Server Actions: no se encolan en el SW.
  Cada módulo decide qué guardar en la cola (`enqueue`) y qué exigir conexión.
- Procesos de IA (`/api/*`) requieren conexión; el SW no los toca.
- Las páginas cacheadas son **personales**: se limpian al cerrar sesión. En un dispositivo compartido, cerrar sesión.

## Actualizaciones

1. Cambiá `VERSION` en `public/sw.js` cuando cambie el shell o las estrategias (los assets de Next ya van hasheados).
2. Al desplegar, el nuevo SW se instala en segundo plano; `<PwaRegister/>` muestra el toast **Nueva versión disponible — Actualizar**.
3. "Actualizar" envía `SKIP_WAITING` y recarga; `activate` borra los caches viejos.
4. Mientras la pestaña esté abierta, se chequea una actualización por hora.

## Instalación

`<InstallPrompt/>` (botón discreto "Instalar app") aparece sólo cuando el navegador dispara `beforeinstallprompt`, la app no está ya en
modo standalone y el usuario no lo descartó en los últimos 14 días (`localStorage: ensenia.install-dismissed-at`). Por ahora se monta
como barra secundaria dentro de `OfflineBanner`; puede moverse al `UserMenu` o al pie del sidebar del shell con `<InstallPrompt variant="button"/>`.

En iOS no existe `beforeinstallprompt`: se instala desde Compartir → "Agregar a inicio"; `appleWebApp` en el layout y `apple-touch-icon.png` cubren ese caso.

## Probar en local

```bash
NEXT_PUBLIC_PWA_DEV=1 npm run dev
```

Luego en DevTools → Application → Service Workers: marcar *Offline* y navegar a una clase ya visitada; la barra debe decir
"Sin conexión" y las placas/resumen deben cargar. Volver a *Online* y verificar "Sincronizando…" → "Todo sincronizado".

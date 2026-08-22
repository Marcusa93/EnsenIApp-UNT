# Google OAuth para EnsenIA UNT — guía + prompt para agente

## Links

| Paso | URL |
|---|---|
| Google Cloud · Credenciales | https://console.cloud.google.com/apis/credentials |
| Google Cloud · Pantalla de consentimiento / Branding | https://console.cloud.google.com/auth/overview |
| Supabase · Providers (Google) | https://supabase.com/dashboard/project/nzihbxbxbbzuvlykuxhg/auth/providers |
| Supabase · URL Configuration | https://supabase.com/dashboard/project/nzihbxbxbbzuvlykuxhg/auth/url-configuration |

Datos fijos que se usan en la configuración:

- **Callback de Supabase (va en Google):** `https://nzihbxbxbbzuvlykuxhg.supabase.co/auth/v1/callback`
- **Redirect URLs de la app (van en Supabase):**
  - `http://localhost:3000/auth/callback`
  - `https://ensenia-unt.vercel.app/auth/callback`
  - `https://*-marcorossi-unteduars-projects.vercel.app/auth/callback`

---

## Prompt para el agente (copiar y pegar tal cual)

```
Tu tarea es dejar funcionando "Iniciar sesión con Google" para la app EnsenIA UNT. Tenés que completar TODOS los pasos hasta el final, verificar cada uno y no detenerte a pedir confirmación salvo que falte una credencial o aparezca un pago. Si un paso falla, diagnosticá y reintentá por otro camino antes de rendirte. Al final reportá: ID de cliente creado, proyecto de Google usado, estado del proveedor en Supabase (enabled) y la lista de Redirect URLs cargadas.

CONTEXTO
- Proyecto Supabase: ref nzihbxbxbbzuvlykuxhg, dashboard https://supabase.com/dashboard/project/nzihbxbxbbzuvlykuxhg
- Callback OAuth de Supabase (es el Authorized redirect URI en Google): https://nzihbxbxbbzuvlykuxhg.supabase.co/auth/v1/callback
- Dominio de producción: https://ensenia-unt.vercel.app  ·  Dev: http://localhost:3000
- Nombre público de la app: "EnsenIA UNT" — Campus de Derecho de las Nuevas Tecnologías y Bioderecho, Facultad de Derecho, Universidad Nacional de Tucumán.
- Email de soporte/desarrollador: el de la cuenta Google con la que estás logueado (usá ese).

PARTE A — GOOGLE CLOUD CONSOLE
1. Ir a https://console.cloud.google.com/apis/credentials. Si pide elegir proyecto: buscá uno llamado "EnsenIA UNT"; si no existe, creá un proyecto nuevo con nombre "EnsenIA UNT" (organización: ninguna / la que aparezca por defecto) y esperá a que se cree y quede seleccionado.
2. Pantalla de consentimiento (branding): ir a https://console.cloud.google.com/auth/overview. Si pide "Get started"/"Comenzar", completá: App name "EnsenIA UNT"; User support email: el de la cuenta; Audience/Tipo de usuario: "External" (Externo); Contact information: el mismo email; aceptar la política y crear. Si pregunta por estado de publicación, dejarla en "Testing" por ahora y luego, si hay botón "Publish app"/"Publicar", publicarla para que cualquier cuenta Google (no sólo test users) pueda entrar; si al publicar pide verificación por scopes sensibles, NO agregues scopes sensibles: sólo usamos email y profile (no requieren verificación) — aceptá y seguí.
3. Si existe la sección "Data access"/"Scopes", asegurate de que estén (o agregá) únicamente: .../auth/userinfo.email, .../auth/userinfo.profile, openid. Guardar.
4. Crear credencial: https://console.cloud.google.com/apis/credentials → "Create credentials" → "OAuth client ID".
   - Application type: "Web application"
   - Name: "EnsenIA UNT Web"
   - Authorized JavaScript origins (agregar los tres):
       https://nzihbxbxbbzuvlykuxhg.supabase.co
       https://ensenia-unt.vercel.app
       http://localhost:3000
   - Authorized redirect URIs (agregar EXACTAMENTE este, sin barra final):
       https://nzihbxbxbbzuvlykuxhg.supabase.co/auth/v1/callback
   - Create. En el modal, copiá el "Client ID" (termina en .apps.googleusercontent.com) y el "Client secret". Guardalos en tu contexto: los necesitás en la Parte B. Si cerraste el modal, volvé a abrir la credencial y usá "Reset secret" o el ícono de descarga del JSON para obtener el secret.

PARTE B — SUPABASE
5. Ir a https://supabase.com/dashboard/project/nzihbxbxbbzuvlykuxhg/auth/providers. Buscar "Google" en la lista de proveedores y expandirlo.
6. Activar el toggle "Enable Sign in with Google". Pegar:
   - Client IDs: el Client ID de la Parte A (si el campo acepta varios separados por coma, poné sólo ese).
   - Client Secret (for OAuth): el Client secret de la Parte A.
   - Dejar desactivado "Skip nonce checks".
   - Verificar que el "Callback URL (for OAuth)" que muestra Supabase sea https://nzihbxbxbbzuvlykuxhg.supabase.co/auth/v1/callback (es el mismo que cargaste en Google).
   - Save.
7. Ir a https://supabase.com/dashboard/project/nzihbxbxbbzuvlykuxhg/auth/url-configuration.
   - Site URL: https://ensenia-unt.vercel.app
   - Redirect URLs → "Add URL" para cada una de estas (exactas):
       http://localhost:3000/auth/callback
       https://ensenia-unt.vercel.app/auth/callback
       https://*-marcorossi-unteduars-projects.vercel.app/auth/callback
   - Save.

PARTE C — VERIFICACIÓN
8. Volver a https://supabase.com/dashboard/project/nzihbxbxbbzuvlykuxhg/auth/providers y confirmar que Google figura como "Enabled".
9. Abrir en una pestaña nueva: https://nzihbxbxbbzuvlykuxhg.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback
   Debe redirigir a la pantalla de Google "Elegí una cuenta" con el nombre "EnsenIA UNT" (si aparece "Error 400: redirect_uri_mismatch", volvé al paso 4 y corregí el redirect URI; si aparece "access blocked: app not verified" es porque la app está en Testing: agregá tu email como Test user en https://console.cloud.google.com/auth/audience o publicá la app como en el paso 2). No hace falta completar el login: con ver la pantalla de Google alcanza.
10. Reportar el resultado con los datos pedidos arriba. No pegues el Client Secret en el reporte; decí sólo que quedó cargado.
```

---

## Notas

- El código de la app ya usa `signInWithOAuth({ provider: "google", options: { redirectTo: \`${origin}/auth/callback\` } })` y el handler `/auth/callback` intercambia el código por sesión. No hay que tocar código.
- Si más adelante se usa un dominio propio (p. ej. `campus.derecho.unt.edu.ar`), agregarlo en: Google → Authorized JavaScript origins; Supabase → Redirect URLs (`https://dominio/auth/callback`) y Site URL; Vercel → Domains.
- El trigger `handle_new_user` toma `full_name`/`avatar_url` de los metadatos que Google envía, y valida contra el padrón (`roster`) automáticamente.

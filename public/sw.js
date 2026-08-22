/* EnsenIA UNT — Service Worker (escrito a mano, sin librerías).
 *
 * Estrategias:
 *  - App shell precacheado (/, /login, /offline, íconos, manifest).
 *  - Navegaciones (GET, mode=navigate): NetworkFirst con timeout de 4 s → cache → /offline.
 *  - Supabase REST GET (<SUPABASE_URL>/rest/v1/*): NetworkFirst 4 s, cache "ensenia-data-<v>".
 *  - /_next/static/*, fuentes y Storage signed URLs: CacheFirst, cache "ensenia-assets-<v>" (con límite).
 *  - Nunca intercepta: POST/PUT/PATCH/DELETE, /api/*, /auth/*, /_next/data, fetches RSC, realtime/auth de Supabase.
 *
 * Subí VERSION en cada deploy que cambie el shell o las estrategias: activate limpia caches viejos.
 */

const VERSION = "2026-08-21.1";
const PREFIX = "ensenia";
const SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const DATA_CACHE = `${PREFIX}-data-${VERSION}`;
const ASSETS_CACHE = `${PREFIX}-assets-${VERSION}`;
const META_CACHE = `${PREFIX}-meta`; // persiste la config entre versiones
const CURRENT_CACHES = new Set([SHELL_CACHE, DATA_CACHE, ASSETS_CACHE, META_CACHE]);

const NETWORK_TIMEOUT_MS = 4000;
const ASSETS_MAX_ENTRIES = 120;
const DATA_MAX_ENTRIES = 300;
const ASSET_MAX_BYTES = 5 * 1024 * 1024; // no guardamos archivos grandes (audio de clases, PDFs pesados)

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  "/login",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/icon.svg",
];

/** Origen de Supabase. Llega por postMessage({type:"CONFIG"}) desde PwaRegister y se persiste en META_CACHE. */
let supabaseOrigin = null;

async function loadConfig() {
  if (supabaseOrigin) return supabaseOrigin;
  try {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match("/__config");
    if (res) {
      const cfg = await res.json();
      if (cfg && typeof cfg.supabaseOrigin === "string") supabaseOrigin = cfg.supabaseOrigin;
    }
  } catch {
    /* sin config persistida */
  }
  return supabaseOrigin;
}

async function saveConfig(cfg) {
  supabaseOrigin = cfg.supabaseOrigin || null;
  try {
    const cache = await caches.open(META_CACHE);
    await cache.put("/__config", new Response(JSON.stringify(cfg), { headers: { "content-type": "application/json" } }));
  } catch (err) {
    console.warn("[sw] no se pudo persistir la config", err);
  }
}

// ---------------------------------------------------------------------------
// Install / Activate
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: "reload", credentials: "same-origin" }));
            // Una respuesta redirigida (p. ej. /login → /campus con sesión) no sirve como fallback de navegación.
            if (res.ok && !res.redirected) await cache.put(url, res);
          } catch (err) {
            console.warn("[sw] no se pudo precachear", url, err);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith(`${PREFIX}-`) && !CURRENT_CACHES.has(n)).map((n) => caches.delete(n)),
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          /* opcional */
        }
      }
      await self.clients.claim();
      await loadConfig();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: "SW_ACTIVATED", version: VERSION });
    })(),
  );
});

// ---------------------------------------------------------------------------
// Mensajes desde la página
// ---------------------------------------------------------------------------

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  switch (data.type) {
    case "CONFIG":
      event.waitUntil(saveConfig({ supabaseOrigin: data.supabaseOrigin }));
      break;
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "CLEAR_DATA":
      event.waitUntil(caches.delete(DATA_CACHE));
      break;
    case "GET_VERSION":
      if (event.source) event.source.postMessage({ type: "SW_VERSION", version: VERSION });
      break;
    default:
      break;
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    // Cache API mantiene orden de inserción: borramos los más viejos.
    const excess = keys.slice(0, keys.length - maxEntries);
    await Promise.all(excess.map((k) => cache.delete(k)));
  } catch (err) {
    console.warn("[sw] trimCache falló", cacheName, err);
  }
}

function isAudioOrVideo(response) {
  const ct = response.headers.get("content-type") || "";
  return ct.startsWith("audio/") || ct.startsWith("video/");
}

function isTooBig(response) {
  const len = Number(response.headers.get("content-length") || 0);
  return len > ASSET_MAX_BYTES;
}

function isSupabaseRestGet(url) {
  if (!url.pathname.startsWith("/rest/v1/")) return false;
  if (supabaseOrigin) return url.origin === supabaseOrigin;
  return url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in");
}

function isSupabaseStorageObject(url) {
  const sameHost = supabaseOrigin ? url.origin === supabaseOrigin : url.hostname.endsWith(".supabase.co");
  if (!sameHost || !url.pathname.startsWith("/storage/v1/object/")) return false;
  // Audio de clases: nunca se cachea completo (peso + datos); sólo texto/placas ya vistas.
  if (url.pathname.includes("/class-recordings/")) return false;
  return true;
}

function isStaticAsset(url, request) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  if (request.destination === "font") return true;
  if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") return true;
  return /\.(?:woff2?|ttf|otf|png|svg|jpg|jpeg|webp|ico)$/i.test(url.pathname);
}

/** Rutas que el SW jamás debe interceptar. */
function isBypassed(url, request) {
  if (request.method !== "GET") return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/auth/")) return true;
  if (url.pathname.startsWith("/_next/data/")) return true;
  if (url.pathname.startsWith("/_next/image")) return true;
  if (url.pathname === "/sw.js") return true;
  // Fetches internos del App Router (RSC payload / prefetch): los maneja Next; si fallan, Next hace navegación dura.
  if (request.headers.get("RSC") === "1" || request.headers.get("Next-Router-Prefetch") === "1") return true;
  if (url.searchParams.has("_rsc")) return true;
  if (url.protocol === "chrome-extension:") return true;
  // Supabase: auth, realtime, functions → nunca se cachean.
  if (url.pathname.startsWith("/auth/v1/") || url.pathname.startsWith("/realtime/v1/") || url.pathname.startsWith("/functions/v1/"))
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// Estrategias
// ---------------------------------------------------------------------------

async function networkFirstNavigation(event) {
  const request = event.request;
  const url = new URL(request.url);
  const cache = await caches.open(SHELL_CACHE);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || (await fetchWithTimeout(request, NETWORK_TIMEOUT_MS));
    if (res && res.ok && !res.redirected && res.type === "basic") {
      cache.put(url.pathname, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached = (await cache.match(url.pathname)) || (await cache.match(request, { ignoreSearch: true }));
    if (cached && !cached.redirected) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("<!doctype html><meta charset=utf-8><title>Sin conexión</title><p>Sin conexión. Volvé a intentar cuando tengas red.</p>", {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}

async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (res && res.ok) {
      cache.put(request, res.clone()).then(() => trimCache(DATA_CACHE, DATA_MAX_ENTRIES)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      // Señalamos que es una copia local para que la UI pueda avisarlo si quiere.
      const headers = new Headers(cached.headers);
      headers.set("X-EnsenIA-Cache", "offline");
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
    }
    throw err;
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque") && !isAudioOrVideo(res) && !isTooBig(res)) {
    cache.put(request, res.clone()).then(() => trimCache(ASSETS_CACHE, ASSETS_MAX_ENTRIES)).catch(() => {});
  }
  return res;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Efecto lateral sin interceptar: al cerrar sesión se descartan los datos cacheados del usuario.
  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/auth/signout") {
    event.waitUntil(caches.delete(DATA_CACHE));
    return;
  }

  if (isBypassed(url, request)) return;

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  event.respondWith(
    (async () => {
      await loadConfig();
      if (isSupabaseRestGet(url)) return networkFirstData(request);
      if (isSupabaseStorageObject(url) || isStaticAsset(url, request)) return cacheFirstAsset(request);
      return fetch(request);
    })(),
  );
});

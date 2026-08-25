import { headers } from "next/headers";

/**
 * Origin real del request (funciona en local, previews de Vercel y producción,
 * sin depender de tener NEXT_PUBLIC_APP_URL sincronizado en cada entorno).
 * Sólo usable en Server Components / Route Handlers.
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

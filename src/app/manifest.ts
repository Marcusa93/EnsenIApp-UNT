import type { MetadataRoute } from "next";

/**
 * Web App Manifest (servido en /manifest.webmanifest).
 * Íconos generados en public/icons (PNG 192/512 + maskable + SVG), en el carmesí de la Facultad.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "EnsenIA UNT",
    short_name: "EnsenIA",
    description:
      "Campus digital de Derecho de las Nuevas Tecnologías y Bioderecho (Facultad de Derecho, UNT). Clases procesadas con IA, también sin conexión. Desarrollado por el Laboratorio de IA, Innovación y Transformación Digital DYNTEC.",
    lang: "es",
    dir: "ltr",
    start_url: "/campus",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#a81828",
    background_color: "#f7f4ef",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Hoy", short_name: "Hoy", url: "/campus", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Clases", short_name: "Clases", url: "/campus/estudiante/clases", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Debates", short_name: "Debates", url: "/campus/debates", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

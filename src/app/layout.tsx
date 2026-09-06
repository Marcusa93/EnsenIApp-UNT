import type { Metadata, Viewport } from "next";
import { Montserrat, Lato, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/shell/motion-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { DYNTEC_CREDIT } from "@/components/shell/developed-by";

// Tipografías de la Facultad de Derecho (derecho.unt.edu.ar): Montserrat para
// títulos y etiquetas, Lato para el texto. JetBrains Mono queda para datos.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ensenia-unt.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "EnsenIA UNT — Campus IA · Facultad de Derecho",
    template: "%s · EnsenIA UNT",
  },
  description: `Campus digital de Derecho de las Nuevas Tecnologías y Bioderecho (Facultad de Derecho y Ciencias Sociales, UNT). Clases grabadas procesadas con IA: resúmenes, placas interactivas, lenguaje simple y feedback personalizado. ${DYNTEC_CREDIT}.`,
  applicationName: "EnsenIA UNT",
  authors: [{ name: "Laboratorio de IA, Innovación y Transformación Digital DYNTEC — Facultad de Derecho, UNT" }],
  creator: "DYNTEC · Facultad de Derecho · UNT",
  // PWA: manifest en src/app/manifest.ts, íconos en public/icons, SW en public/sw.js (ver docs/PWA.md).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EnsenIA" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  // Íconos y OG: convenciones de archivo (src/app/icon.svg, apple-icon.tsx, opengraph-image.tsx).
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "EnsenIA UNT",
    title: "EnsenIA UNT — Campus IA · Facultad de Derecho",
    description: `Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI. Un campus que procesa las clases con IA. ${DYNTEC_CREDIT}.`,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#120f13" },
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${montserrat.variable} ${lato.variable} ${jetbrainsMono.variable} h-full overflow-x-hidden antialiased`}
    >
      <head>
        {/* Aplica el tema elegido antes del primer paint (ver ThemeToggle). type
            alterna server/client para que React no advierta por un <script> que,
            en navegaciones del lado del cliente, no vuelve a ejecutarse (guía
            oficial de Next 16, "Preventing flash before hydration"). */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-background text-foreground">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:font-display focus:font-bold focus:text-white"
        >
          Saltar al contenido
        </a>
        <MotionProvider>{children}</MotionProvider>
        <PwaRegister />
      </body>
    </html>
  );
}

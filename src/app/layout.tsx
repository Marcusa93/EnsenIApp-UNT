import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
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
    default: "EnsenIA UNT — Campus IA",
    template: "%s · EnsenIA UNT",
  },
  description:
    "Campus digital de Derecho de las Nuevas Tecnologías y Bioderecho (Facultad de Derecho, UNT). Clases grabadas procesadas con IA: resúmenes, placas interactivas, lenguaje simple y feedback personalizado.",
  applicationName: "EnsenIA UNT",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }],
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "EnsenIA UNT",
    title: "EnsenIA UNT — Campus IA",
    description: "Derecho de las Nuevas Tecnologías y Bioderecho en el Siglo XXI. Un campus que procesa las clases con IA.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "EnsenIA UNT" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070812" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}

import type { UserRole } from "@/lib/types/helpers";

export interface NavItem {
  href: string;
  label: string;
  /** lucide-react icon name, resolved by the shell */
  icon:
    | "LayoutDashboard"
    | "CalendarDays"
    | "Layers"
    | "ClipboardList"
    | "MessageCircleQuestion"
    | "TrendingUp"
    | "Swords"
    | "Users"
    | "FileBarChart"
    | "Shield"
    | "Bell"
    | "Feather"
    | "Gamepad2"
    | "Settings"
    | "BookOpen";
  roles: UserRole[];
}

/**
 * Mapa de rutas del campus. Es la única fuente de verdad para la navegación:
 * el shell la renderiza, y cada módulo implementa exactamente estas rutas.
 */
export const NAV: NavItem[] = [
  // Estudiante
  { href: "/campus/estudiante", label: "Hoy", icon: "LayoutDashboard", roles: ["estudiante"] },
  { href: "/campus/estudiante/clases", label: "Clases", icon: "CalendarDays", roles: ["estudiante"] },
  // Alberdi va temprano a propósito: la bottom nav mobile muestra sólo los primeros 5.
  { href: "/campus/estudiante/alberdi", label: "Alberdi", icon: "Feather", roles: ["estudiante"] },
  // Juegos entra en la bottom nav mobile (5 primeros): es una función de uso
  // frecuente y corto, justo lo que se abre desde el celular entre clase y clase.
  { href: "/campus/estudiante/juegos", label: "Juegos", icon: "Gamepad2", roles: ["estudiante"] },
  { href: "/campus/estudiante/biblioteca", label: "Biblioteca", icon: "BookOpen", roles: ["estudiante"] },
  { href: "/campus/estudiante/actividades", label: "Actividades", icon: "ClipboardList", roles: ["estudiante"] },
  { href: "/campus/estudiante/consultas", label: "Consultas", icon: "MessageCircleQuestion", roles: ["estudiante"] },
  // Debates es compartida pero se declara por rol para controlar el orden:
  // para docente/admin va DESPUÉS de sus ítems propios (Panel primero, Consultas
  // visible en la bottom nav mobile, que muestra sólo los primeros 5).
  { href: "/campus/debates", label: "Debates", icon: "Swords", roles: ["estudiante"] },
  { href: "/campus/estudiante/progreso", label: "Mi progreso", icon: "TrendingUp", roles: ["estudiante"] },

  // Docente
  { href: "/campus/docente", label: "Panel", icon: "LayoutDashboard", roles: ["docente", "admin"] },
  { href: "/campus/docente/clases", label: "Clases", icon: "CalendarDays", roles: ["docente", "admin"] },
  { href: "/campus/docente/actividades", label: "Actividades", icon: "ClipboardList", roles: ["docente", "admin"] },
  { href: "/campus/docente/estudiantes", label: "Estudiantes", icon: "Users", roles: ["docente", "admin"] },
  { href: "/campus/docente/consultas", label: "Consultas", icon: "MessageCircleQuestion", roles: ["docente", "admin"] },
  { href: "/campus/debates", label: "Debates", icon: "Swords", roles: ["docente", "admin"] },
  { href: "/campus/docente/informes", label: "Informes", icon: "FileBarChart", roles: ["docente", "admin"] },
  { href: "/campus/docente/juegos", label: "Juegos", icon: "Gamepad2", roles: ["docente", "admin"] },

  // Admin
  { href: "/campus/admin", label: "Administración", icon: "Shield", roles: ["admin"] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}

export function homeForRole(role: UserRole): string {
  if (role === "estudiante") return "/campus/estudiante";
  return "/campus/docente";
}

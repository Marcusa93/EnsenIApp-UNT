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
    | "Bell";
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
  { href: "/campus/estudiante/actividades", label: "Actividades", icon: "ClipboardList", roles: ["estudiante"] },
  { href: "/campus/estudiante/consultas", label: "Consultas", icon: "MessageCircleQuestion", roles: ["estudiante"] },
  { href: "/campus/debates", label: "Debates", icon: "Swords", roles: ["estudiante", "docente", "admin"] },
  { href: "/campus/estudiante/progreso", label: "Mi progreso", icon: "TrendingUp", roles: ["estudiante"] },

  // Docente
  { href: "/campus/docente", label: "Panel", icon: "LayoutDashboard", roles: ["docente", "admin"] },
  { href: "/campus/docente/clases", label: "Clases", icon: "CalendarDays", roles: ["docente", "admin"] },
  { href: "/campus/docente/actividades", label: "Actividades", icon: "ClipboardList", roles: ["docente", "admin"] },
  { href: "/campus/docente/estudiantes", label: "Estudiantes", icon: "Users", roles: ["docente", "admin"] },
  { href: "/campus/docente/consultas", label: "Consultas", icon: "MessageCircleQuestion", roles: ["docente", "admin"] },
  { href: "/campus/docente/informes", label: "Informes", icon: "FileBarChart", roles: ["docente", "admin"] },

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

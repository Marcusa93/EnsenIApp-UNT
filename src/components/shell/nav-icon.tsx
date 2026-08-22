import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileChartColumn,
  LayoutDashboard,
  Layers,
  MessageCircleQuestionMark,
  Shield,
  Swords,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

/**
 * Resuelve el nombre declarado en src/lib/nav.ts a un ícono de lucide-react 1.x.
 * (FileBarChart y MessageCircleQuestion fueron renombrados en lucide; se mapean acá.)
 */
const ICONS: Record<NavItem["icon"], LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Layers,
  ClipboardList,
  MessageCircleQuestion: MessageCircleQuestionMark,
  TrendingUp,
  Swords,
  Users,
  FileBarChart: FileChartColumn,
  Shield,
  Bell,
};

export function NavIcon({ name, className }: { name: NavItem["icon"]; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden />;
}

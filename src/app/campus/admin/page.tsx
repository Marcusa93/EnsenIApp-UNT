import type { Metadata } from "next";
import { Shield, Users, BookOpen, GraduationCap, Activity } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Stat } from "@/components/ui";
import { RevealGroup, RevealItem } from "@/components/shell";
import { getAdminData, getSystemData } from "./_lib/data";
import { AdminTabs, type AdminTab } from "./_components/admin-tabs";

export const metadata: Metadata = { title: "Administración" };

const TABS: AdminTab[] = ["usuarios", "cursos", "docentes", "cuerpo", "sistema"];

function isAdminTab(value: string | undefined): value is AdminTab {
  return value !== undefined && (TABS as string[]).includes(value);
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // requireRole redirige si no es admin; recién después usamos service role para ver todos los perfiles.
  await requireRole("admin");
  const { tab } = await searchParams;
  const db = createAdminClient();
  const [data, system] = await Promise.all([getAdminData(db), getSystemData(db)]);

  const pendientes = data.profiles.filter((p) => p.status === "pendiente").length;
  const docentes = data.profiles.filter((p) => p.role === "docente" || p.role === "admin").length;
  const enError = system.pipeline.find((p) => p.status === "error")?.count ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Shield className="size-3.5" aria-hidden /> Administración
          </span>
        }
        title="Panel de administración"
        description="Roles y validación de usuarios, materias y cursos, asignación docente, cuerpo de cátedra y estado del sistema."
      />

      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevealItem>
          <Stat
            label="Usuarios"
            value={data.profiles.length}
            hint={pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"} de validar` : "Todos validados"}
            icon={<Users />}
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Cursos"
            value={data.courses.length}
            hint={`${data.subjects.length} materia${data.subjects.length === 1 ? "" : "s"}`}
            icon={<BookOpen />}
            tone="accent-2"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Equipo docente"
            value={docentes}
            hint={`${data.faculty.length} en el cuerpo público`}
            icon={<GraduationCap />}
            tone="accent-3"
          />
        </RevealItem>
        <RevealItem>
          <Stat
            label="Pipeline IA"
            value={enError}
            hint={enError > 0 ? "grabaciones con error" : "sin errores"}
            icon={<Activity />}
            tone={enError > 0 ? "accent-3" : "muted"}
          />
        </RevealItem>
      </RevealGroup>

      <div className="mt-8">
        <AdminTabs initialTab={isAdminTab(tab) ? tab : "usuarios"} data={data} system={system} />
      </div>
    </>
  );
}

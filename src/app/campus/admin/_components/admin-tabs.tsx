"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users, BookOpen, UserCheck, GraduationCap, ServerCog } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import type { AdminData, SystemData } from "../_lib/data";
import { UsersTab } from "./users-tab";
import { CoursesTab } from "./courses-tab";
import { AssignmentsTab } from "./assignments-tab";
import { FacultyTab } from "./faculty-tab";
import { SystemTab } from "./system-tab";

export type AdminTab = "usuarios" | "cursos" | "docentes" | "cuerpo" | "sistema";

export function AdminTabs({ initialTab, data, system }: { initialTab: AdminTab; data: AdminData; system: SystemData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<AdminTab>(initialTab);

  const onChange = (value: string) => {
    const next = value as AdminTab;
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const pendientes = data.profiles.filter((p) => p.status === "pendiente").length;
  const errores = system.pipeline.find((p) => p.status === "error")?.count ?? 0;

  return (
    <Tabs value={tab} onValueChange={onChange}>
      <TabsList aria-label="Secciones de administración">
        <TabsTrigger value="usuarios" icon={<Users />} count={pendientes > 0 ? pendientes : undefined}>
          Usuarios
        </TabsTrigger>
        <TabsTrigger value="cursos" icon={<BookOpen />}>
          Cursos
        </TabsTrigger>
        <TabsTrigger value="docentes" icon={<UserCheck />}>
          Docentes por curso
        </TabsTrigger>
        <TabsTrigger value="cuerpo" icon={<GraduationCap />}>
          Cuerpo docente
        </TabsTrigger>
        <TabsTrigger value="sistema" icon={<ServerCog />} count={errores > 0 ? errores : undefined}>
          Sistema
        </TabsTrigger>
      </TabsList>
      <TabsContent value="usuarios">
        <UsersTab profiles={data.profiles} courses={data.courses} />
      </TabsContent>
      <TabsContent value="cursos">
        <CoursesTab subjects={data.subjects} courses={data.courses} />
      </TabsContent>
      <TabsContent value="docentes">
        <AssignmentsTab courses={data.courses} assignments={data.assignments} profiles={data.profiles} />
      </TabsContent>
      <TabsContent value="cuerpo">
        <FacultyTab faculty={data.faculty} subjects={data.subjects} profiles={data.profiles} />
      </TabsContent>
      <TabsContent value="sistema">
        <SystemTab system={system} />
      </TabsContent>
    </Tabs>
  );
}

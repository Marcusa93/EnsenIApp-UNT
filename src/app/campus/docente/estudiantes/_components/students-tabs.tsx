"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, UserCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";

export type StudentsTab = "inscriptos" | "padron" | "pendientes";

export interface StudentsTabsProps {
  initial: StudentsTab;
  counts: Record<StudentsTab, number>;
  inscriptos: React.ReactNode;
  padron: React.ReactNode;
  pendientes: React.ReactNode;
}

/** Tabs sincronizadas con ?tab= para poder linkear directo (p. ej. desde el panel). */
export function StudentsTabs({ initial, counts, inscriptos, padron, pendientes }: StudentsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [tab, setTab] = React.useState<StudentsTab>(initial);

  const onChange = (v: string) => {
    const next = v as StudentsTab;
    setTab(next);
    const params = new URLSearchParams(sp.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={onChange}>
      <TabsList aria-label="Secciones de estudiantes" className="mb-5">
        <TabsTrigger value="inscriptos" icon={<Users />} count={counts.inscriptos}>
          Inscriptos
        </TabsTrigger>
        <TabsTrigger value="padron" icon={<ClipboardList />} count={counts.padron}>
          Padrón
        </TabsTrigger>
        <TabsTrigger value="pendientes" icon={<UserCheck />} count={counts.pendientes}>
          Pendientes
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inscriptos">{inscriptos}</TabsContent>
      <TabsContent value="padron">{padron}</TabsContent>
      <TabsContent value="pendientes">{pendientes}</TabsContent>
    </Tabs>
  );
}

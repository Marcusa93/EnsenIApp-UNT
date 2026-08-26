"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Feather, MessageCircleQuestion } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";

export type ConsultasTab = "consultas" | "encuestas" | "alberdi";

export interface ConsultasTabsProps {
  initial: ConsultasTab;
  counts: Record<ConsultasTab, number>;
  consultas: React.ReactNode;
  encuestas: React.ReactNode;
  alberdi: React.ReactNode;
}

/** Tabs sincronizadas con ?tab= para poder linkear directo (p. ej. ?tab=encuestas&classId=…). */
export function ConsultasTabs({ initial, counts, consultas, encuestas, alberdi }: ConsultasTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [tab, setTab] = React.useState<ConsultasTab>(initial);

  const onChange = (v: string) => {
    const next = v as ConsultasTab;
    setTab(next);
    const params = new URLSearchParams(sp.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={onChange}>
      <TabsList aria-label="Consultas y encuestas" className="mb-5">
        <TabsTrigger value="consultas" icon={<MessageCircleQuestion />} count={counts.consultas}>
          Consultas
        </TabsTrigger>
        <TabsTrigger value="encuestas" icon={<BarChart3 />} count={counts.encuestas}>
          Encuestas
        </TabsTrigger>
        <TabsTrigger value="alberdi" icon={<Feather />} count={counts.alberdi}>
          Alberdi
        </TabsTrigger>
      </TabsList>
      <TabsContent value="consultas">{consultas}</TabsContent>
      <TabsContent value="encuestas">{encuestas}</TabsContent>
      <TabsContent value="alberdi">{alberdi}</TabsContent>
    </Tabs>
  );
}

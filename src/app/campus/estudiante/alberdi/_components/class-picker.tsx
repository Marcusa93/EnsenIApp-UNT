"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

export interface ClassPickerOption {
  id: string;
  topic: string;
  date: string;
}

/**
 * Elige sobre qué se conversa. Navega en vez de guardar estado local: la página
 * arma el contexto (sugerencias, transcripción minutada) del lado del servidor a
 * partir de `?classId=`, así que el cambio tiene que pasar por la URL.
 */
export function ClassPicker({ classes, activeId }: { classes: ClassPickerOption[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Select
      value={activeId ?? ""}
      disabled={pending}
      aria-label="Elegí sobre qué clase querés consultar"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => {
          router.push(next ? `/campus/estudiante/alberdi?classId=${next}` : "/campus/estudiante/alberdi");
        });
      }}
      className="sm:w-80"
    >
      <option value="">Toda la materia</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.date.slice(8, 10)}/{c.date.slice(5, 7)} · {c.topic}
        </option>
      ))}
    </Select>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Select, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CourseWithSubject } from "@/lib/courses";
import { setActiveCourse } from "./course-actions";

export interface CourseSwitcherProps {
  courses: CourseWithSubject[];
  activeCourseId: string;
  className?: string;
}

/**
 * Selector de curso activo. Con un solo curso muestra una etiqueta;
 * con varios, un <Select> que persiste la elección en cookie y refresca la ruta.
 */
export function CourseSwitcher({ courses, activeCourseId, className }: CourseSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  const active = courses.find((c) => c.id === activeCourseId) ?? courses[0];

  if (courses.length <= 1) {
    if (!active) return null;
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge tone="accent-2" dot>
          <GraduationCap className="size-3" aria-hidden />
          {active.name} · {active.term}
        </Badge>
      </div>
    );
  }

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setError(null);
    startTransition(async () => {
      const res = await setActiveCourse(next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="eyebrow">
        Curso activo
      </label>
      <Select
        id={id}
        value={active?.id ?? ""}
        onChange={onChange}
        disabled={pending}
        aria-busy={pending || undefined}
        className="min-w-56"
        options={courses.map((c) => ({
          value: c.id,
          label: `${c.name} · ${c.term}`,
        }))}
      />
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

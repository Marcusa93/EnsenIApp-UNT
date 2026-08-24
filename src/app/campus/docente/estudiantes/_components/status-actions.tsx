"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { setStudentStatus } from "../actions";
import type { ProfileStatus } from "./students-data";

export interface StatusActionsProps {
  courseId: string;
  studentId: string;
  status: ProfileStatus;
  size?: "sm" | "md";
  onError?: (message: string | null) => void;
}

/** Botones validar / bloquear / reactivar para un estudiante. */
export function StatusActions({ courseId, studentId, status, size = "sm", onError }: StatusActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [target, setTarget] = React.useState<ProfileStatus | null>(null);

  const change = (next: ProfileStatus) => {
    if (next === "bloqueado" && !window.confirm("¿Bloquear a este estudiante? No va a poder entrar al campus.")) return;
    setTarget(next);
    onError?.(null);
    startTransition(async () => {
      const res = await setStudentStatus({ course_id: courseId, student_id: studentId, status: next });
      setTarget(null);
      if (!res.ok) {
        onError?.(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== "validado" && (
        <Button
          size={size}
          variant="secondary"
          leftIcon={<CheckCircle2 />}
          loading={pending && target === "validado"}
          disabled={pending}
          onClick={() => change("validado")}
        >
          Validar
        </Button>
      )}
      {status !== "bloqueado" ? (
        <Button
          size={size}
          variant="ghost"
          leftIcon={<Ban />}
          loading={pending && target === "bloqueado"}
          disabled={pending}
          onClick={() => change("bloqueado")}
          className="text-danger hover:bg-danger/10"
        >
          Bloquear
        </Button>
      ) : (
        <Button
          size={size}
          variant="ghost"
          leftIcon={<RotateCcw />}
          loading={pending && target === "pendiente"}
          disabled={pending}
          onClick={() => change("pendiente")}
        >
          Reactivar
        </Button>
      )}
    </div>
  );
}

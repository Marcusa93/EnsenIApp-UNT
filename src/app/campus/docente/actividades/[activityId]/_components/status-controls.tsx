"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, RotateCcw, Send, Trash2 } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import type { ActivityStatus } from "@/components/activities/model";
import { deleteActivity, setActivityStatus } from "../../actions";

export function StatusControls({
  activityId,
  status,
  hasSubmissions,
}: {
  activityId: string;
  status: ActivityStatus;
  hasSubmissions: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<"close" | "delete" | null>(null);

  const change = (next: ActivityStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await setActivityStatus(activityId, next);
      if (!res.ok) setError(res.error);
      else {
        setConfirm(null);
        router.refresh();
      }
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteActivity(activityId);
      if (!res.ok) setError(res.error);
      else router.push("/campus/docente/actividades");
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <Button leftIcon={<Send />} loading={pending} onClick={() => change("published")}>
              Publicar
            </Button>
            <Button variant="danger" size="icon" aria-label="Eliminar borrador" disabled={pending} onClick={() => setConfirm("delete")}>
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
        {status === "published" && (
          <>
            <Button variant="secondary" leftIcon={<Lock />} loading={pending} onClick={() => setConfirm("close")}>
              Cerrar actividad
            </Button>
            {!hasSubmissions && (
              <Button variant="ghost" leftIcon={<RotateCcw />} disabled={pending} onClick={() => change("draft")}>
                Volver a borrador
              </Button>
            )}
          </>
        )}
        {status === "closed" && (
          <Button variant="secondary" leftIcon={<RotateCcw />} loading={pending} onClick={() => change("published")}>
            Reabrir
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <Dialog
        open={confirm === "close"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Cerrar la actividad?"
        description="Los estudiantes dejan de poder entregar. Podés reabrirla más tarde."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={() => change("closed")}>
              Cerrar actividad
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Eliminar este borrador?"
        description="Esta acción no se puede deshacer."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" loading={pending} onClick={remove}>
              Eliminar
            </Button>
          </>
        }
      />
    </div>
  );
}

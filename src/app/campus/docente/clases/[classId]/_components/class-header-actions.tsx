"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import type { StaffOption } from "@/components/docente/class-data";
import { ClassFormDialog, type ClassFormValues } from "../../_components/class-form-dialog";
import { deleteClass } from "../../actions";

export interface ClassHeaderActionsProps {
  courseId: string;
  staff: StaffOption[];
  values: ClassFormValues & { id: string };
}

/** Editar / eliminar la clase desde su página. */
export function ClassHeaderActions({ courseId, staff, values }: ClassHeaderActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteClass(values.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/campus/docente/clases");
    });
  };

  return (
    <>
      <Button variant="secondary" leftIcon={<Pencil />} onClick={() => setEditOpen(true)}>
        Editar
      </Button>
      <Button variant="ghost" className="hover:text-danger" leftIcon={<Trash2 />} onClick={() => setDeleteOpen(true)}>
        Eliminar
      </Button>
      <ClassFormDialog open={editOpen} onOpenChange={setEditOpen} courseId={courseId} staff={staff} initial={values} />
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !pending && setDeleteOpen(o)}
        title="Eliminar clase"
        description="Se borran también sus grabaciones, materiales, avisos y check-ins. Esta acción no se puede deshacer."
        size="sm"
        dismissable={!pending}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={onDelete} loading={pending} leftIcon={<Trash2 />}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="text-sm font-medium">{values.topic}</p>
        {error && (
          <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}

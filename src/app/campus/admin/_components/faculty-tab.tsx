"use client";

import * as React from "react";
import { Check, GraduationCap, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, Dialog, EmptyState, Field, Input, Select } from "@/components/ui";
import type { AdminFaculty, AdminProfile, AdminSubject } from "../_lib/data";
import { deleteFaculty, upsertFaculty } from "../actions";
import { useAction } from "./use-action";
import { Feedback } from "./feedback";

export function FacultyTab({
  faculty,
  subjects,
  profiles,
}: {
  faculty: AdminFaculty[];
  subjects: AdminSubject[];
  profiles: AdminProfile[];
}) {
  const [dialog, setDialog] = React.useState<{ open: boolean; member: AdminFaculty | null }>({ open: false, member: null });

  const bySubject = React.useMemo(() => {
    const map = new Map<string, AdminFaculty[]>();
    for (const f of faculty) {
      const list = map.get(f.subject_id) ?? [];
      list.push(f);
      map.set(f.subject_id, list);
    }
    return map;
  }, [faculty]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          El cuerpo docente se muestra públicamente en la landing, ordenado por <span className="font-mono">rank</span>{" "}
          (menor primero). Vincular un perfil es opcional y sirve para mostrar su avatar y enlazar su cuenta.
        </p>
        <Button
          size="sm"
          leftIcon={<Plus />}
          disabled={subjects.length === 0}
          onClick={() => setDialog({ open: true, member: null })}
        >
          Agregar integrante
        </Button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Primero necesitás una materia"
          description="El cuerpo docente se agrupa por materia. Creala en la pestaña Cursos."
        />
      ) : faculty.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          tone="accent-3"
          title="El cuerpo docente está vacío"
          description="Agregá titulares, adjuntos y auxiliares con su cargo para que aparezcan en la landing."
          action={
            <Button leftIcon={<Plus />} onClick={() => setDialog({ open: true, member: null })}>
              Agregar integrante
            </Button>
          }
        />
      ) : (
        subjects.map((s) => {
          const members = bySubject.get(s.id) ?? [];
          if (members.length === 0) return null;
          return (
            <section key={s.id} aria-labelledby={`faculty-${s.id}`} className="flex flex-col gap-2">
              <h2 id={`faculty-${s.id}`} className="eyebrow">
                {s.name} · {members.length}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => (
                  <FacultyRow key={m.id} member={m} onEdit={() => setDialog({ open: true, member: m })} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <FacultyDialog
        open={dialog.open}
        member={dialog.member}
        subjects={subjects}
        profiles={profiles}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </div>
  );
}

function FacultyRow({ member, onEdit }: { member: AdminFaculty; onEdit: () => void }) {
  const { pending, error, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);

  const remove = async () => {
    const result = await run(() => deleteFaculty({ id: member.id }));
    if (result.ok) setConfirm(false);
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent-3/40 sm:p-4">
      <div className="flex items-start gap-3">
        <Avatar name={member.full_name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{member.full_name}</p>
            <Badge tone="muted" size="sm">
              #{member.rank}
            </Badge>
          </div>
          <p className="text-xs text-accent-3">{member.position}</p>
          {member.profile ? (
            <p className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted">
              <Link2 className="size-3" aria-hidden /> {member.profile.email}
            </p>
          ) : (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">Sin cuenta vinculada</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" aria-label={`Editar ${member.full_name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 hover:text-danger"
            aria-label={`Eliminar ${member.full_name}`}
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <Feedback error={error} />
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title="Quitar del cuerpo docente"
        description={`${member.full_name} dejará de aparecer en la landing. Su cuenta (si tiene) no se toca.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={pending} leftIcon={<Trash2 />}>
              Quitar
            </Button>
          </>
        }
      />
    </li>
  );
}

function FacultyDialog({
  open,
  member,
  subjects,
  profiles,
  onOpenChange,
}: {
  open: boolean;
  member: AdminFaculty | null;
  subjects: AdminSubject[];
  profiles: AdminProfile[];
  onOpenChange: (open: boolean) => void;
}) {
  const { pending, error, run, reset } = useAction();
  const [subjectId, setSubjectId] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [rank, setRank] = React.useState("99");
  const [profileId, setProfileId] = React.useState("");
  const formId = React.useId();

  const linkable = React.useMemo(
    () =>
      profiles
        .filter((p) => p.role !== "estudiante")
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es")),
    [profiles],
  );

  React.useEffect(() => {
    if (!open) return;
    setSubjectId(member?.subject_id ?? subjects[0]?.id ?? "");
    setFullName(member?.full_name ?? "");
    setPosition(member?.position ?? "");
    setRank(String(member?.rank ?? 99));
    setProfileId(member?.profile_id ?? "");
    reset();
  }, [open, member, subjects, reset]);

  const onProfileChange = (id: string) => {
    setProfileId(id);
    // Si todavía no escribió nombre, lo autocompletamos desde el perfil.
    if (!fullName.trim() && id) {
      const p = linkable.find((x) => x.id === id);
      if (p) setFullName(p.full_name);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await run(() =>
      upsertFaculty({
        id: member?.id,
        subjectId,
        fullName,
        position,
        rank,
        profileId: profileId || null,
      }),
    );
    if (result.ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? "Editar integrante" : "Nuevo integrante"}
      description="Así aparece en la sección Cuerpo docente de la landing."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={pending} leftIcon={<Check />}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Materia" htmlFor={`${formId}-subject`} required>
          <Select
            id={`${formId}-subject`}
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Elegí una materia"
            required
          />
        </Field>
        <Field label="Cuenta vinculada" htmlFor={`${formId}-profile`} hint="opcional">
          <Select
            id={`${formId}-profile`}
            value={profileId}
            onChange={(e) => onProfileChange(e.target.value)}
            placeholder="Sin vincular"
          >
            <option value="">Sin vincular</option>
            {linkable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} · {p.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre completo" htmlFor={`${formId}-name`} required>
          <Input
            id={`${formId}-name`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dra. María Fernández"
            required
            minLength={3}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label="Cargo" htmlFor={`${formId}-position`} required>
            <Input
              id={`${formId}-position`}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Profesora titular"
              required
              minLength={2}
            />
          </Field>
          <Field label="Orden" htmlFor={`${formId}-rank`} hint="menor = primero">
            <Input
              id={`${formId}-rank`}
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
            />
          </Field>
        </div>
        <Feedback error={error} />
      </form>
    </Dialog>
  );
}

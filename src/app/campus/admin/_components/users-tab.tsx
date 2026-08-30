"use client";

import * as React from "react";
import { Search, UserPlus, UserX } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Field, Input, Select, type BadgeTone } from "@/components/ui";
import { ROLE_LABEL } from "@/components/shell";
import { formatRelative } from "@/lib/format";
import type { UserRole } from "@/lib/types/helpers";
import type { Enums } from "@/lib/types/helpers";
import type { AdminCourse, AdminProfile } from "../_lib/data";
import { createUser, setUserRole, setUserStatus } from "../actions";
import { useAction } from "./use-action";
import { Feedback } from "./feedback";

type ProfileStatus = Enums<"profile_status">;

const STATUS_LABEL: Record<ProfileStatus, string> = {
  pendiente: "Pendiente",
  validado: "Validado",
  bloqueado: "Bloqueado",
};

const STATUS_TONE: Record<ProfileStatus, BadgeTone> = {
  pendiente: "warning",
  validado: "success",
  bloqueado: "danger",
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "estudiante", label: "Estudiante" },
  { value: "docente", label: "Docente" },
  { value: "admin", label: "Admin" },
];

const STATUS_OPTIONS: { value: ProfileStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "validado", label: "Validado" },
  { value: "bloqueado", label: "Bloqueado" },
];

type RoleFilter = "todos" | UserRole;
type StatusFilter = "todos" | ProfileStatus;

export function UsersTab({ profiles, courses }: { profiles: AdminProfile[]; courses: AdminCourse[] }) {
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("todos");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("todos");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

  const filtered = React.useMemo(() => {
    return profiles.filter((p) => {
      if (roleFilter !== "todos" && p.role !== roleFilter) return false;
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (!deferredQuery) return true;
      return p.full_name.toLowerCase().includes(deferredQuery) || (p.email?.toLowerCase().includes(deferredQuery) ?? false);
    });
  }, [profiles, roleFilter, statusFilter, deferredQuery]);

  return (
    <div className="flex flex-col gap-4">
      <NuevoUsuario courses={courses} />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          type="search"
          placeholder="Buscar por nombre o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search />}
          aria-label="Buscar usuarios"
        />
        <Select
          aria-label="Filtrar por rol"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          options={[{ value: "todos", label: "Todos los roles" }, ...ROLE_OPTIONS]}
          className="sm:w-44"
        />
        <Select
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          options={[{ value: "todos", label: "Todos los estados" }, ...STATUS_OPTIONS]}
          className="sm:w-44"
        />
      </div>

      <p className="eyebrow text-[10px]">
        {filtered.length} de {profiles.length} usuario{profiles.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserX}
          compact
          tone="muted"
          title="Ningún usuario coincide"
          description="Probá con otro nombre o email, o quitá los filtros."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => (
            <UserRow key={p.id} profile={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UserRow({ profile }: { profile: AdminProfile }) {
  const { pending, error, success, run } = useAction();
  const [role, setRole] = React.useState<UserRole>(profile.role);
  const [status, setStatus] = React.useState<ProfileStatus>(profile.status);

  // Re-sincroniza el estado optimista cuando el server component revalida (ajuste durante render, sin efecto).
  const [synced, setSynced] = React.useState({ role: profile.role, status: profile.status });
  if (synced.role !== profile.role || synced.status !== profile.status) {
    setSynced({ role: profile.role, status: profile.status });
    setRole(profile.role);
    setStatus(profile.status);
  }

  const changeRole = async (next: UserRole) => {
    const prev = role;
    setRole(next);
    const result = await run(() => setUserRole({ userId: profile.id, role: next }), "Rol actualizado.");
    if (!result.ok) setRole(prev);
  };

  const changeStatus = async (next: ProfileStatus) => {
    const prev = status;
    setStatus(next);
    const result = await run(() => setUserStatus({ userId: profile.id, status: next }), "Estado actualizado.");
    if (!result.ok) setStatus(prev);
  };

  return (
    <li className="rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent/40 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <Badge tone={STATUS_TONE[status]} size="sm" dot>
                {STATUS_LABEL[status]}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted">{profile.email}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
              {ROLE_LABEL[role]} · alta {formatRelative(profile.created_at)}
              {profile.last_seen_at ? ` · visto ${formatRelative(profile.last_seen_at)}` : " · nunca ingresó"}
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-72">
          <Select
            aria-label={`Rol de ${profile.full_name}`}
            value={role}
            disabled={pending}
            onChange={(e) => void changeRole(e.target.value as UserRole)}
            options={ROLE_OPTIONS}
          />
          <Select
            aria-label={`Estado de ${profile.full_name}`}
            value={status}
            disabled={pending}
            onChange={(e) => void changeStatus(e.target.value as ProfileStatus)}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>
      <Feedback error={error} success={success} className="mt-2" />
    </li>
  );
}

/**
 * Alta de cuentas desde el propio campus, sin scripts ni consola de Supabase.
 *
 * Se puede dar de alta por email real o por usuario suelto: el login resuelve
 * un identificador sin "@" contra el dominio interno, así el docente entra
 * escribiendo nada más que su usuario. La contraseña se muestra una sola vez al
 * confirmar, porque es lo único que hay que pasarle a mano a la persona.
 */
function NuevoUsuario({ courses }: { courses: AdminCourse[] }) {
  const [abierto, setAbierto] = React.useState(false);
  const [identifier, setIdentifier] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("estudiante");
  const [password, setPassword] = React.useState("");
  const [courseId, setCourseId] = React.useState("");
  const [creado, setCreado] = React.useState<{ email: string; password: string } | null>(null);
  const { pending, error, run, reset } = useAction();

  function limpiar() {
    setIdentifier("");
    setFullName("");
    setRole("estudiante");
    setPassword("");
    setCourseId("");
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(
      () => createUser({ identifier, fullName, role, password, courseId: courseId || null }),
      "Usuario creado.",
    );
    if (result.ok) {
      setCreado({ email: result.data.email, password });
      limpiar();
    }
  }

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2/40 px-4 py-3">
        <p className="text-sm text-muted">Dar de alta a alguien que todavía no tiene cuenta en el campus.</p>
        <Button
          size="sm"
          leftIcon={<UserPlus />}
          onClick={() => {
            reset();
            setCreado(null);
            setAbierto(true);
          }}
        >
          Nuevo usuario
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={crear} className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Nuevo usuario</h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre y apellido" htmlFor="nu-nombre">
          <Input
            id="nu-nombre"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="María López"
            required
            autoComplete="off"
          />
        </Field>
        <Field
          label="Email o usuario"
          htmlFor="nu-id"
          hint="Con email real entra con el email; con un usuario suelto, escribiendo sólo ese usuario."
        >
          <Input
            id="nu-id"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="mlopez  ·  maria@derecho.unt.edu.ar"
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Rol" htmlFor="nu-rol">
          <Select
            id="nu-rol"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={ROLE_OPTIONS}
          />
        </Field>
        <Field label="Contraseña inicial" htmlFor="nu-pass" hint="Mínimo 6 caracteres. Se la pasás vos y la puede cambiar después.">
          <Input
            id="nu-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Al menos 6 caracteres"
            minLength={6}
            required
            autoComplete="new-password"
          />
        </Field>
        {role !== "admin" && courses.length > 0 && (
          <Field
            label={role === "estudiante" ? "Inscribir en la comisión" : "Asignar a la comisión"}
            htmlFor="nu-curso"
            hint="Opcional: queda listo para trabajar sin un segundo paso."
            className="sm:col-span-2"
          >
            <Select
              id="nu-curso"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              options={[
                { value: "", label: "No asociar por ahora" },
                ...courses.map((c) => ({ value: c.id, label: `${c.subject?.name ?? "Materia"} · ${c.name}` })),
              ]}
            />
          </Field>
        )}
      </div>

      <Feedback error={error} success={null} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={pending} leftIcon={!pending ? <UserPlus /> : undefined}>
          Crear usuario
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAbierto(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>

      {creado && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
          <p className="font-medium text-success">Cuenta creada. Pasale estos datos:</p>
          <p className="mt-1 font-mono text-[13px] text-foreground">
            {creado.email.endsWith("@ensenia-unt.local") ? creado.email.split("@")[0] : creado.email} · {creado.password}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Anotalos ahora: la contraseña no se puede volver a ver. Si se pierde, creás una nueva desde acá.
          </p>
        </div>
      )}
    </form>
  );
}

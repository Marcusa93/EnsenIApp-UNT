"use client";

import * as React from "react";
import { Search, UserX } from "lucide-react";
import { Avatar, Badge, EmptyState, Input, Select, type BadgeTone } from "@/components/ui";
import { ROLE_LABEL } from "@/components/shell";
import { formatRelative } from "@/lib/format";
import type { UserRole } from "@/lib/types/helpers";
import type { Enums } from "@/lib/types/helpers";
import type { AdminProfile } from "../_lib/data";
import { setUserRole, setUserStatus } from "../actions";
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

export function UsersTab({ profiles }: { profiles: AdminProfile[] }) {
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("todos");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("todos");
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

  const filtered = React.useMemo(() => {
    return profiles.filter((p) => {
      if (roleFilter !== "todos" && p.role !== roleFilter) return false;
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (!deferredQuery) return true;
      return p.full_name.toLowerCase().includes(deferredQuery) || p.email.toLowerCase().includes(deferredQuery);
    });
  }, [profiles, roleFilter, statusFilter, deferredQuery]);

  return (
    <div className="flex flex-col gap-4">
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

  React.useEffect(() => setRole(profile.role), [profile.role]);
  React.useEffect(() => setStatus(profile.status), [profile.status]);

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

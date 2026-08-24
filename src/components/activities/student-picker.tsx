"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { EnrolledStudent } from "./queries";

export interface StudentPickerProps {
  students: EnrolledStudent[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/** Buscador + lista con checkboxes + chips de seleccionados. */
export function StudentPicker({ students, selected, onChange, disabled }: StudentPickerProps) {
  const [query, setQuery] = React.useState("");
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? students.filter((s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    : students;

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedSet.has(s.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          leftIcon={<Search />}
          placeholder="Buscar por nombre o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar estudiantes"
          disabled={disabled}
        />
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || filtered.length === 0}
            onClick={() =>
              onChange(
                allFilteredSelected
                  ? selected.filter((id) => !filtered.some((s) => s.id === id))
                  : Array.from(new Set([...selected, ...filtered.map((s) => s.id)])),
              )
            }
          >
            {allFilteredSelected ? "Quitar visibles" : "Elegir visibles"}
          </Button>
          {selected.length > 0 && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Estudiantes seleccionados">
          {selected.map((id) => {
            const s = students.find((x) => x.id === id);
            if (!s) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 py-1 pl-2.5 pr-1.5 text-xs text-foreground transition-colors hover:border-danger/50 hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Quitar a ${s.full_name}`}
                >
                  {s.full_name}
                  <X className="size-3 text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div
        role="listbox"
        aria-multiselectable="true"
        aria-label="Inscriptos del curso"
        className="max-h-72 overflow-y-auto rounded-xl border border-border bg-surface-2/40"
      >
        {students.length === 0 ? (
          <p className="p-4 text-sm text-muted">Todavía no hay estudiantes inscriptos en este curso.</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">Ningún estudiante coincide con “{query}”.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const active = selectedSet.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={disabled}
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
                      active && "bg-accent/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        active ? "border-accent bg-accent text-white" : "border-border bg-surface",
                      )}
                      aria-hidden
                    >
                      {active && <Check className="size-3.5" />}
                    </span>
                    <Avatar name={s.full_name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.full_name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted">{s.email}</span>
                    </span>
                    {s.status === "pendiente" && (
                      <Badge size="sm" tone="warning">
                        Pendiente
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
        {selected.length} de {students.length} seleccionados
      </p>
    </div>
  );
}

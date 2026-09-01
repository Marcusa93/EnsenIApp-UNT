"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserRound } from "lucide-react";
import { Button, Card, CardTitle, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";

/**
 * Corregir el nombre propio.
 *
 * Las cuentas que da de alta la cátedra a partir de una lista de emails nacen
 * con un nombre deducido del email ("Pilarbaronetto"), porque el email es lo
 * único que hay. Sin esto, esa deformación queda para siempre: en la tabla de
 * posiciones, en la ficha que ve el docente y en cada consulta que manda.
 *
 * El alias del operador es otra cosa y se elige aparte: este es el nombre real,
 * el que ve el equipo docente.
 */
export function NombreForm({ inicial }: { inicial: string }) {
  const router = useRouter();
  const [nombre, setNombre] = React.useState(inicial);
  const [guardando, setGuardando] = React.useState(false);
  const [listo, setListo] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const limpio = nombre.trim().replace(/\s+/g, " ");
  const cambio = limpio !== inicial.trim();

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (limpio.length < 3) {
      setError("Escribí tu nombre y apellido.");
      return;
    }
    setGuardando(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ data: { full_name: limpio } });
      if (err) throw err;
      // El perfil es lo que lee el resto del campus; el metadata de auth queda
      // sincronizado por las dudas, pero la fuente de verdad es esta tabla.
      const { data: sesion } = await supabase.auth.getUser();
      if (sesion.user) {
        const { error: perfilErr } = await supabase
          .from("profiles")
          .update({ full_name: limpio })
          .eq("id", sesion.user.id);
        if (perfilErr) throw perfilErr;
      }
      setListo(true);
      setNombre(limpio);
      router.refresh();
      window.setTimeout(() => setListo(false), 2500);
    } catch (err) {
      setError(errorMessage(err, "No pudimos guardar tu nombre. Probá de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardTitle eyebrow="Tus datos" as="h2">
        Tu nombre
      </CardTitle>
      <p className="mt-1 text-sm text-muted">
        Así te ve el equipo docente. Si la cátedra creó tu cuenta desde tu email, puede haber quedado mal escrito.
      </p>
      <form onSubmit={guardar} className="mt-3 flex flex-col gap-3">
        <Field label="Nombre y apellido" htmlFor="nombre-real">
          <Input
            id="nombre-real"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={120}
            autoComplete="name"
            placeholder="María López"
            disabled={guardando}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="sm"
            disabled={!cambio || guardando}
            leftIcon={guardando ? <Loader2 className="animate-spin" /> : listo ? <Check /> : <UserRound />}
          >
            {listo ? "Guardado" : "Guardar"}
          </Button>
          {listo && <span className="text-sm text-success">Listo, así te ven ahora.</span>}
        </div>
      </form>
    </Card>
  );
}

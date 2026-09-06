"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function CampusError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("[campus] error de ruta", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-6 sm:py-10">
      <EmptyState
        icon={TriangleAlert}
        tone="accent"
        title="Algo salió mal al cargar esta sección"
        description={
          <>
            {error.message && !/digest/i.test(error.message) ? error.message : "No pudimos completar la carga."}{" "}
            Podés reintentar; si persiste, avisale al equipo docente.
            {error.digest && (
              <span className="mt-3 flex items-center justify-center gap-2">
                <span className="eyebrow">ref</span>
                {/* El identificador del error es un dato: va en mono. */}
                <span className="font-mono text-[11px] tabular-nums text-muted">{error.digest}</span>
              </span>
            )}
          </>
        }
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
            <Button onClick={reset} leftIcon={<RefreshCw />} className="w-full sm:w-auto">
              Reintentar
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/campus">Ir al inicio</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

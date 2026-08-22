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
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={TriangleAlert}
        tone="accent-3"
        title="Algo salió mal al cargar esta sección"
        description={
          <>
            {error.message && !/digest/i.test(error.message) ? error.message : "No pudimos completar la carga."}{" "}
            Podés reintentar; si persiste, avisale al equipo docente.
            {error.digest && (
              <span className="mt-2 block font-mono text-[10px] uppercase tracking-widest text-muted">
                ref {error.digest}
              </span>
            )}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset} leftIcon={<RefreshCw />}>
              Reintentar
            </Button>
            <Button asChild variant="secondary">
              <Link href="/campus">Ir al inicio</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

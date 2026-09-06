import { Skeleton } from "@/components/ui";

export default function ClassesLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando el cronograma">
      {/* Cabecera con la pleca del PageHeader */}
      <div className="pleca mb-6 sm:mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      {/* Segmento de filtros */}
      <div className="mb-6 flex w-full gap-1 rounded-xl border border-border bg-surface-2 p-1 sm:w-fit">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="hidden h-9 w-24 rounded-lg sm:block" />
      </div>
      {/* Mes + línea de tiempo */}
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-3 w-28" />
        <span className="h-px flex-1 bg-border" aria-hidden />
        <Skeleton className="h-3 w-5" />
      </div>
      <div className="ml-3 flex flex-col gap-4 border-l border-border pl-6 sm:ml-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-border bg-surface p-4 sm:gap-4">
            <Skeleton className="h-14 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-2 h-3 w-16 rounded-md" />
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton lines={2} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

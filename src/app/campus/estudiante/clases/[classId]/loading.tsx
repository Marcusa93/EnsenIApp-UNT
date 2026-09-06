import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ClassDetailLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando la clase">
      <Skeleton className="mb-4 h-4 w-28" />
      {/* Cabecera con la pleca del PageHeader */}
      <div className="pleca mb-6 sm:mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-4 lg:col-span-8">
          {/* Bloque de grabación: cabecera, reproductor y tabs */}
          <div className="rounded-2xl border border-border border-t-[3px] border-t-accent bg-surface">
            <div className="border-b border-border p-5 sm:p-6">
              <Skeleton className="mb-3 h-3 w-36" />
              <Skeleton className="mb-3 h-5 w-2/3" />
              <Skeleton className="mb-4 h-4 w-full max-w-md" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex gap-4 border-b border-border pb-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton lines={5} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui";

export default function ActividadesLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando actividades">
      <div className="pleca mb-6 sm:mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:justify-between">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-10 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
              <div className="flex-1">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-5 w-3/4" />
              </div>
              <Skeleton className="h-5 w-full md:w-52" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

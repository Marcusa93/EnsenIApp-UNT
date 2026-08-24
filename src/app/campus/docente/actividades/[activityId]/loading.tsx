import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ActividadDocenteLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando actividad">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="mb-4 h-3 w-24" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-72" />
      <SkeletonCard />
    </div>
  );
}

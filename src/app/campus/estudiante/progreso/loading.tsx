import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ProgresoLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando tu progreso">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <SkeletonCard className="min-h-64 lg:col-span-8" />
        <SkeletonCard className="min-h-64 lg:col-span-4" />
      </div>
      <div className="mt-10">
        <Skeleton className="mb-4 h-3 w-48" />
        <Skeleton className="h-11 w-56 rounded-xl" />
        <SkeletonCard className="mt-6" />
      </div>
    </div>
  );
}

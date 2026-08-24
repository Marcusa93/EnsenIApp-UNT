import { Skeleton, SkeletonCard } from "@/components/ui";

export default function EstudianteLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando ficha del estudiante">
      <Skeleton className="mb-4 h-3 w-36" />
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <SkeletonCard className="min-h-[360px]" />
        <SkeletonCard className="min-h-[360px]" />
      </div>
    </div>
  );
}

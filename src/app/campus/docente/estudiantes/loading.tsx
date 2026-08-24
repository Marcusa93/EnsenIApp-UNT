import { Skeleton, SkeletonCard } from "@/components/ui";

export default function EstudiantesLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando estudiantes">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <Skeleton className="mb-5 h-10 w-80 max-w-full" />
      <SkeletonCard className="min-h-[420px]" />
    </div>
  );
}

import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ActividadEstudianteLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando la actividad">
      <div className="mb-8">
        <Skeleton className="mb-3 h-8 w-32" />
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-3/4 max-w-xl" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

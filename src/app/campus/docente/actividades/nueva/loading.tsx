import { Skeleton, SkeletonCard } from "@/components/ui";

export default function NuevaActividadLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando formulario">
      <Skeleton className="mb-3 h-8 w-32" />
      <div className="pleca mb-6 sm:mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="mb-5 h-10 w-96 max-w-full" />
      <SkeletonCard />
    </div>
  );
}

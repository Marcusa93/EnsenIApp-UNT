import { Skeleton, SkeletonCard } from "@/components/ui";

export default function StudentHomeLoading() {
  return (
    <div className="animate-fade-in" role="status" aria-busy="true" aria-label="Cargando tu panel de hoy">
      {/* Mismo esqueleto que el hero: pleca carmesí, fecha, saludo y bajada. */}
      <div className="pleca mb-6 sm:mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-72 max-w-full sm:h-10 sm:w-96" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <SkeletonCard className="border-t-[3px] border-t-accent/40 lg:col-span-7" />
        <SkeletonCard className="lg:col-span-5" />
        <SkeletonCard className="lg:col-span-7" />
        <SkeletonCard className="lg:col-span-5" />
        <SkeletonCard className="lg:col-span-7" />
        <SkeletonCard className="lg:col-span-5" />
      </div>
    </div>
  );
}

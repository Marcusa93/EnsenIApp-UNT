import { Skeleton, SkeletonCard } from "@/components/ui";

export default function InformeLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando informe">
      <Skeleton className="mb-4 h-3 w-32" />
      <Skeleton className="mb-3 h-3 w-40" />
      <Skeleton className="h-8 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard className="mt-6 min-h-[480px]" />
    </div>
  );
}

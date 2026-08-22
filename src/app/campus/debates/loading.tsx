import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DebatesLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando debates">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-28" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="mb-3 h-3 w-20" />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard className="hidden md:block" />
        <SkeletonCard className="hidden md:block" />
      </div>
    </div>
  );
}

import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function CampusLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard className="hidden lg:block" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

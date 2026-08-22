import { Skeleton, SkeletonCard } from "@/components/ui";

export default function InformesLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando informes">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkeletonCard className="min-h-[420px]" />
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

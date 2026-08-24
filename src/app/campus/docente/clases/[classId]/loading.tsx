import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ClaseDocenteLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando clase">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-48" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

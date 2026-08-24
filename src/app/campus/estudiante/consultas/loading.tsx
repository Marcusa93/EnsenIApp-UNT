import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ConsultasLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando tus consultas">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SkeletonCard className="min-h-80" />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-7">
          <Skeleton className="h-3 w-28" />
          <SkeletonCard />
          <SkeletonCard />
          <Skeleton className="mt-4 h-3 w-40" />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

import { Skeleton, SkeletonCard } from "@/components/ui";

export default function StudentHomeLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando tu panel de hoy">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <SkeletonCard className="lg:col-span-7" />
        <SkeletonCard className="lg:col-span-5" />
        <SkeletonCard className="lg:col-span-7" />
        <SkeletonCard className="lg:col-span-5" />
        <SkeletonCard className="lg:col-span-7" />
        <SkeletonCard className="lg:col-span-5" />
      </div>
    </div>
  );
}

import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function DebateLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando debate">
      <Skeleton className="mb-4 h-3 w-32" />
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton lines={4} />
        <Skeleton className="mt-5 h-2 w-full" />
      </div>
      <Skeleton className="mb-4 h-32 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard className="hidden lg:block" />
      </div>
    </div>
  );
}

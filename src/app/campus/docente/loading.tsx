import { Skeleton, SkeletonCard } from "@/components/ui";

export default function DocentePanelLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando panel">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="mb-4 h-3 w-24" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <div className="rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="mb-4 h-3 w-32" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

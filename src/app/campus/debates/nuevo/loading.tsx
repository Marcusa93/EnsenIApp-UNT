import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function NewDebateLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando formulario">
      <Skeleton className="mb-4 h-3 w-20" />
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <Skeleton className="mb-5 h-3 w-16" />
          <Skeleton className="mb-5 h-11 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="flex flex-col gap-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

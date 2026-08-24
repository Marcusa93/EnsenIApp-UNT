import { Skeleton, SkeletonCard } from "@/components/ui";

export default function ClassDetailLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando la clase">
      <Skeleton className="mb-4 h-3 w-40" />
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

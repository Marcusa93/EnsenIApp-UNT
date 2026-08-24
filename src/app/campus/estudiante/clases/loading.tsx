import { Skeleton } from "@/components/ui";

export default function ClassesLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando el cronograma">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <Skeleton className="mb-4 h-3 w-28" />
      <div className="flex flex-col gap-3 border-l border-border pl-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

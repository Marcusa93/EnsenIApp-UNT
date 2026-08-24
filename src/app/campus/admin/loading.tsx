import { Skeleton } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando administración">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="mb-4 h-3 w-24" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-8">
        <div className="flex gap-1 border-b border-border pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-11 w-full max-w-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

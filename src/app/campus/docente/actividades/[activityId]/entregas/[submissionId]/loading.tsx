import { Skeleton, SkeletonCard } from "@/components/ui";

export default function CorregirEntregaLoading() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Cargando entrega">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

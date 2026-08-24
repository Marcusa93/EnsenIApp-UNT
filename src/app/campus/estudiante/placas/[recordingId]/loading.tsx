import { Skeleton } from "@/components/ui";

export default function CardsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-xl animate-fade-in flex-col gap-4 py-2 sm:py-4" aria-busy="true" aria-label="Cargando las placas">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-2 h-1.5 w-full" />
        </div>
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-[22rem] rounded-3xl sm:h-[24rem]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

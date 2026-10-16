import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header bar loading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-10 w-72 rounded-xl" />
      </div>

      {/* Grid Kartu KPI Loading */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20 rounded-sm" />
              <Skeleton className="size-8 rounded-xl" />
            </div>
            <Skeleton className="my-3 h-8 w-28 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-sm" />
          </div>
        ))}
      </div>

      {/* Grid Grafik Loading */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="mt-2 h-3.5 w-64 rounded-sm" />
          <Skeleton className="mt-6 h-[240px] w-full rounded-lg" />
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="mt-2 h-3.5 w-64 rounded-sm" />
          <Skeleton className="mt-6 h-[240px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function YouTubeResultsSkeleton() {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
import { Skeleton } from "@/components/ui/skeleton";

export function YouTubeResultsSkeleton() {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="
            overflow-hidden
            rounded-2xl
            border
          "
        >
          <Skeleton className="aspect-video w-full rounded-none" />

          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
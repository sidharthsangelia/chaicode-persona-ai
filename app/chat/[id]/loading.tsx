import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the chat and its messages come back from Postgres.
 *
 * Without a boundary here the previous chat stays frozen on screen for the
 * length of that query, which reads as a dead click rather than a load.
 * The shapes mirror the real transcript so nothing jumps when it swaps in.
 */
export default function ChatLoading() {
  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
        <div className="flex justify-end">
          <Skeleton className="h-12 w-2/5 rounded-3xl" />
        </div>

        <div className="flex gap-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-12 w-1/3 rounded-3xl" />
        </div>

        <div className="flex gap-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>

      <div className="p-4">
        <Skeleton className="mx-auto h-14 w-full max-w-3xl rounded-[30px]" />
      </div>
    </div>
  );
}

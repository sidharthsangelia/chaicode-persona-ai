import Image from "next/image";
import { Card } from "@/components/ui/card";
import type { YouTubeResult } from "@/lib/ai/tools/youtube";

export function YouTubeResults({
  results,
}: {
  results: YouTubeResult[];
}) {
  if (!results?.length) return null;

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {results.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <Card
            className="
              overflow-hidden
              rounded-2xl
              p-0
              transition-all
              duration-200
              hover:-translate-y-0.5
            "
          >
            <div className="relative aspect-video overflow-hidden">
              {r.thumbnail && (
                <Image
                  src={r.thumbnail}
                  alt={r.title}
                  fill
                  unoptimized
                  className="
                    object-cover
                    transition-transform
                    duration-300
                    group-hover:scale-[1.02]
                  "
                />
              )}

              <div className="absolute right-2 top-2 rounded-full border bg-background/90 px-2 py-1 text-[10px] font-medium backdrop-blur">
                {r.type === "playlist"
                  ? "Playlist"
                  : "Video"}
              </div>
            </div>

            <div className="space-y-2 p-4">
              <h3 className="line-clamp-2 text-sm font-medium leading-6">
                {r.title}
              </h3>

              <p className="text-xs text-muted-foreground">
                {r.channel}
              </p>
            </div>
          </Card>
        </a>
      ))}
    </div>
  );
}
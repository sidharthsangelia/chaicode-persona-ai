import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { YouTubeResult } from "@/lib/ai/tools/youtube";

export function YouTubeResults({ results }: { results: YouTubeResult[] }) {
  if (!results?.length) return null;

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {results.map((r) => (
        <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="group block">
          <Card className="overflow-hidden py-0 transition-colors group-hover:border-primary/50">
            <div className="relative aspect-video w-full bg-muted">
              {r.thumbnail && (
                // unoptimized: sidesteps next.config remotePatterns setup — fine for now, revisit post-eval
                <Image src={r.thumbnail} alt={r.title} fill unoptimized className="object-cover" />
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {r.type === "playlist" ? "Playlist" : "Video"}
              </span>
            </div>
            <CardContent className="px-3 py-2.5">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{r.title}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{r.channel}</p>
            </CardContent>
          </Card>
        </a>
      ))}
    </div>
  );
}
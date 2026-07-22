import { Clock } from "lucide-react";
import type { Citation } from "@/lib/rag/citations";

/**
 * Where an answer came from, in the course.
 *
 * The numbers here are the same numbers the answer text carries inline, which is
 * the only reason the citation filter renumbers on the way out — a learner
 * reading "...cite [2]" needs to find a 2 in this list, not a gap where
 * retrieval happened to rank things differently.
 *
 * Deliberately a list rather than thumbnail cards: these point at a minute of a
 * lesson, and a timestamp is the payload. Once lessons have real URLs each row
 * becomes a deep link; until then the text is the whole deliverable.
 */
export function CourseCitations({ citations }: { citations: Citation[] }) {
  if (!citations?.length) return null;

  return (
    <section className="mt-5">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Where this is covered
      </h4>

      <ol className="divide-y overflow-hidden rounded-xl border">
        {citations.map((c) => (
          <li key={c.n} className="flex gap-3 p-3">
            <span
              className="
                mt-0.5
                flex
                h-5
                w-5
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-muted
                text-[11px]
                font-medium
                tabular-nums
              "
            >
              {c.n}
            </span>

            <div className="min-w-0 flex-1">
              {/* module › chapter › timestamp — the address a learner needs to
                  find this moment in the course folder. */}
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium leading-6">
                  <span className="text-muted-foreground">
                    {c.moduleLabel}
                    <span className="mx-1.5 opacity-60">›</span>
                  </span>
                  {c.chapterLabel && `${c.chapterLabel}: `}
                  {c.lessonTitle}
                </p>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {c.timestamp}
                </span>
              </div>

              <p className="truncate text-xs text-muted-foreground">
                {c.segmentTitle} · {c.instructor}
              </p>

              {/* The directory verbatim. The title above is prettified, so it
                  does not match what a file browser lists. */}
              {c.folderName && (
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70">
                  {c.folderName}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

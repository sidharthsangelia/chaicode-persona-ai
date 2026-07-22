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
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium leading-6">
                  {c.lessonTitle}
                </p>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {c.timestamp}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Module {c.moduleNum} · {c.instructor} · {c.segmentTitle}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

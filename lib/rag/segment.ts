import { z } from "zod";
import { fallbackSegments } from "./chunk";
import { cachedObject, MODELS } from "./llm";
import type { Cue, Lesson, Segment } from "./types";

/**
 * Topic-block sizing. Chosen target is 1-3 minutes: narrow enough that the
 * answering model isn't reading unrelated material, wide enough that a
 * walkthrough isn't cut mid-explanation.
 */
const TARGET_MS = 120_000;
/** Below this a block carries no independent meaning; merge it forward. */
const MIN_MS = 45_000;
/** Above this the model under-segmented; split on time as a backstop. */
const MAX_MS = 240_000;

/**
 * Long lessons are segmented in overlapping windows. Accuracy of index-emitting
 * degrades over long numbered lists — the corpus max is 920 cues — so no single
 * call is ever asked to track more than this many.
 */
const WINDOW_CUES = 220;
const WINDOW_OVERLAP_CUES = 40;
/** Boundaries closer than this are treated as the same cut when reconciling. */
const DEDUPE_CUES = 4;

const boundarySchema = z.object({
  boundaries: z.array(
    z.object({
      startCue: z
        .number()
        .int()
        .describe("Index of the cue that starts this topic block"),
      title: z.string().describe("Short descriptive title for the topic block"),
    }),
  ),
});

const SYSTEM = `You segment course-video transcripts into topic blocks.

You are given numbered subtitle cues. Identify the cue indices where the instructor genuinely changes topic — starts a new concept, moves to a new file, or begins a new step of a walkthrough.

Rules:
- Return ONLY cue indices that appear in the input.
- Aim for blocks of roughly 1-3 minutes. Cues average ~4 seconds, so that is roughly 15-45 cues per block.
- Do not create blocks shorter than ~10 cues unless the topic change is unmistakable.
- Titles must describe what is taught, using the concrete API, package, or feature names the instructor says.
- Never rewrite, summarize, or quote transcript text as a cue index. Indices only.`;

interface RawBoundary {
  startCue: number;
  title: string;
}

function buildWindows(cueCount: number): Array<[number, number]> {
  if (cueCount <= WINDOW_CUES) return [[0, cueCount - 1]];

  const windows: Array<[number, number]> = [];
  let start = 0;
  const step = WINDOW_CUES - WINDOW_OVERLAP_CUES;

  while (start < cueCount) {
    const end = Math.min(start + WINDOW_CUES - 1, cueCount - 1);
    windows.push([start, end]);
    if (end === cueCount - 1) break;
    start += step;
  }
  return windows;
}

async function boundariesForWindow(
  lesson: Lesson,
  cues: Cue[],
  from: number,
  to: number,
): Promise<RawBoundary[]> {
  const slice = cues.slice(from, to + 1);
  const numbered = slice.map((c) => `${c.i}: ${c.text}`).join("\n");

  const prompt = `Lesson: "${lesson.title}" (${lesson.moduleLabel})
Cue indices in this excerpt run from ${from} to ${to}.

${numbered}`;

  try {
    const { object } = await cachedObject({
      model: MODELS.segment,
      system: SYSTEM,
      prompt,
      schema: boundarySchema,
      schemaName: "boundaries.v1",
    });
    return object.boundaries;
  } catch {
    // A failed window degrades that stretch to time-based blocks rather than
    // failing the lesson; the caller's normalization fills the gap.
    return [];
  }
}

/** Duration of the block starting at `boundaries[i]`, through to the next cut. */
function blockMs(boundaries: RawBoundary[], i: number, cues: Cue[]): number {
  const endCue =
    i + 1 < boundaries.length
      ? boundaries[i + 1].startCue - 1
      : cues.length - 1;
  return cues[endCue].endMs - cues[boundaries[i].startCue].startMs;
}

/** Splits blocks the model left too long, on time, keeping the original title. */
function splitOversized(boundaries: RawBoundary[], cues: Cue[]): RawBoundary[] {
  const out: RawBoundary[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    out.push(boundaries[i]);
    const endCue =
      i + 1 < boundaries.length
        ? boundaries[i + 1].startCue - 1
        : cues.length - 1;
    let cursor = boundaries[i].startCue;

    while (cues[endCue].endMs - cues[cursor].startMs > MAX_MS) {
      const splitAt = cues.findIndex(
        (c, idx) =>
          idx > cursor && c.startMs - cues[cursor].startMs >= TARGET_MS,
      );
      if (splitAt <= cursor || splitAt > endCue) break;
      out.push({
        startCue: splitAt,
        title: `${boundaries[i].title} (continued)`,
      });
      cursor = splitAt;
    }
  }

  return out;
}

/**
 * Merges blocks shorter than MIN_MS into a neighbour.
 *
 * Measures each block's ACTUAL duration rather than the gap between successive
 * starts — the gap only tells you how long the *previous* block was, which
 * leaves the final block unchecked and lets a sliver through at the end of a
 * lesson. Loops to fixpoint because merging can leave the result still short.
 */
function mergeUndersized(
  boundaries: RawBoundary[],
  cues: Cue[],
): RawBoundary[] {
  const out = [...boundaries];

  // Each pass removes exactly one boundary, so the initial length bounds the
  // work; a shrinking loop bound would stop before reaching a fixpoint.
  for (let pass = boundaries.length; pass > 0 && out.length > 1; pass--) {
    const short = out.findIndex((_, i) => blockMs(out, i, cues) < MIN_MS);
    if (short === -1) break;
    // Absorb into the predecessor; the first block instead swallows its successor.
    out.splice(short === 0 ? 1 : short, 1);
  }

  return out;
}

/**
 * Turns model output into trustworthy boundaries.
 *
 * Everything here is defensive: the model's indices are untrusted input. Out of
 * range, duplicated, unsorted, too dense, and too sparse are all observed
 * failure modes, and each is corrected rather than propagated into a citation.
 */
function normalize(raw: RawBoundary[], cues: Cue[]): RawBoundary[] {
  const maxIndex = cues.length - 1;

  const seen = new Set<number>();
  let boundaries = raw
    .filter((b) => Number.isInteger(b.startCue))
    .filter((b) => b.startCue >= 0 && b.startCue <= maxIndex)
    .sort((a, b) => a.startCue - b.startCue)
    .filter((b) => {
      if (seen.has(b.startCue)) return false;
      seen.add(b.startCue);
      return true;
    });

  // Collapse near-duplicate cuts produced by overlapping windows. Compares
  // against the last KEPT boundary, not the previous input element — otherwise
  // a run of close cuts drops entries that are far enough from what survived.
  boundaries = boundaries.reduce<RawBoundary[]>((kept, b) => {
    if (
      kept.length === 0 ||
      b.startCue - kept[kept.length - 1].startCue > DEDUPE_CUES
    ) {
      kept.push(b);
    }
    return kept;
  }, []);

  // The first block must cover the start of the lesson, or its cues are orphaned.
  if (boundaries.length === 0 || boundaries[0].startCue !== 0) {
    boundaries.unshift({ startCue: 0, title: "Introduction" });
  }

  // Merge before split, and the two passes converge in one go: merging grows a
  // block and can push it over MAX_MS, but splitting only ever fires while the
  // remainder exceeds MAX_MS and removes TARGET_MS at a time, so its tail always
  // lands in (TARGET_MS, MAX_MS] — never short enough to need merging again.
  return splitOversized(mergeUndersized(boundaries, cues), cues);
}

function toSegments(
  lesson: Lesson,
  cues: Cue[],
  boundaries: RawBoundary[],
): Segment[] {
  return boundaries.map((b, i) => {
    const startCue = b.startCue;
    const endCue =
      i + 1 < boundaries.length
        ? boundaries[i + 1].startCue - 1
        : cues.length - 1;
    const slice = cues.slice(startCue, endCue + 1);

    return {
      id: `${lesson.id}#s${String(i).padStart(2, "0")}`,
      lessonId: lesson.id,
      ordinal: i,
      title: b.title.trim() || `Part ${i + 1}`,
      startCue,
      endCue,
      startMs: slice[0].startMs,
      endMs: slice[slice.length - 1].endMs,
      text: slice
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    };
  });
}

/**
 * Segments one lesson into topic blocks.
 *
 * Never throws: if every model window fails, the lesson falls back to
 * time-based blocks so ingest completes with degraded quality rather than a
 * hole in the index.
 */
export async function segmentLesson(
  lesson: Lesson,
  cues: Cue[],
): Promise<Segment[]> {
  const windows = buildWindows(cues.length);

  const perWindow = await Promise.all(
    windows.map(([from, to]) => boundariesForWindow(lesson, cues, from, to)),
  );
  const raw = perWindow.flat();

  if (raw.length === 0) {
    const blocks = fallbackSegments(cues, TARGET_MS);
    return toSegments(
      lesson,
      cues,
      blocks.map((b, i) => ({ startCue: b.startCue, title: `Part ${i + 1}` })),
    );
  }

  return toSegments(lesson, cues, normalize(raw, cues));
}

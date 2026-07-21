import type { Cue } from "./types";

/**
 * Windowing turns a run of cues into overlapping retrieval units.
 *
 * Sizing is driven by wall-clock duration rather than character count because
 * speech rate across this corpus is near-uniform (4.3s / 52 chars per cue), so
 * a duration target gives consistent token sizes AND makes the citation window
 * a predictable length for the user to land in.
 */
export interface WindowOptions {
  /** Preferred window length. 60s ≈ 14 cues ≈ 183 tokens on this corpus. */
  targetMs?: number;
  /** Fraction of each window repeated in the next, so a concept split across
   *  a boundary is still wholly present in at least one window. */
  overlapRatio?: number;
  /** Hard guards for outlier cue pacing (long pauses, rapid-fire cues). */
  minCues?: number;
  maxCues?: number;
  /** Windows shorter than this fraction of target get merged backwards
   *  instead of emitted as a runt. */
  minTailRatio?: number;
}

const DEFAULTS: Required<WindowOptions> = {
  targetMs: 60_000,
  overlapRatio: 0.25,
  minCues: 4,
  maxCues: 40,
  minTailRatio: 0.4,
};

export interface CueWindow {
  /** Absolute cue indices within the lesson, inclusive. */
  startCue: number;
  endCue: number;
  startMs: number;
  endMs: number;
  text: string;
}

function buildWindow(cues: Cue[], from: number, to: number): CueWindow {
  const slice = cues.slice(from, to + 1);
  return {
    startCue: slice[0].i,
    endCue: slice[slice.length - 1].i,
    startMs: slice[0].startMs,
    endMs: slice[slice.length - 1].endMs,
    text: slice
      .map((c) => c.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * Splits a contiguous run of cues into overlapping windows.
 *
 * `cues` is expected to be one segment's slice; the absolute `Cue.i` values are
 * carried through untouched, so emitted indices stay valid against the full
 * lesson regardless of where the slice came from.
 */
export function windowCues(cues: Cue[], options: WindowOptions = {}): CueWindow[] {
  const opts = { ...DEFAULTS, ...options };
  if (cues.length === 0) return [];
  if (cues.length <= opts.minCues) return [buildWindow(cues, 0, cues.length - 1)];

  const windows: CueWindow[] = [];
  let start = 0;

  while (start < cues.length) {
    let end = start;
    while (
      end + 1 < cues.length &&
      end - start + 1 < opts.maxCues &&
      (end - start + 1 < opts.minCues ||
        cues[end].endMs - cues[start].startMs < opts.targetMs)
    ) {
      end++;
    }

    windows.push(buildWindow(cues, start, end));

    // Reached the end — no further window can add anything new.
    if (end === cues.length - 1) break;

    const span = end - start + 1;
    // Always advance by at least one cue, or identical windows repeat forever.
    start += Math.max(1, Math.round(span * (1 - opts.overlapRatio)));
  }

  // A short trailing window carries little independent signal and its content
  // is mostly already covered by the overlap, so fold it into its predecessor.
  if (windows.length > 1) {
    const tail = windows[windows.length - 1];
    if (tail.endMs - tail.startMs < opts.targetMs * opts.minTailRatio) {
      const prev = windows[windows.length - 2];
      windows.splice(
        windows.length - 2,
        2,
        buildWindow(
          cues,
          cues.findIndex((c) => c.i === prev.startCue),
          cues.findIndex((c) => c.i === tail.endCue),
        ),
      );
    }
  }

  return windows;
}

/**
 * Non-overlapping parent-sized blocks used when LLM segmentation is skipped or
 * fails. Purely time-based, so it always succeeds — the pipeline degrades to
 * fixed parents rather than falling over.
 */
export function fallbackSegments(
  cues: Cue[],
  targetMs = 240_000,
): Array<{ startCue: number; endCue: number }> {
  if (cues.length === 0) return [];
  const blocks: Array<{ startCue: number; endCue: number }> = [];
  let start = 0;
  for (let i = 0; i < cues.length; i++) {
    if (
      cues[i].endMs - cues[start].startMs >= targetMs ||
      i === cues.length - 1
    ) {
      blocks.push({ startCue: cues[start].i, endCue: cues[i].i });
      start = i + 1;
    }
  }
  return blocks;
}

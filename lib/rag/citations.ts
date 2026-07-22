import type { LessonRef, RetrievedChunk, SegmentContext } from "./retrieve";
import { formatTimestamp } from "./types";

/**
 * Citations: turning retrieved chunks into something the model can point at, and
 * validating that it only pointed at things it was actually given.
 *
 * The invariant from types.ts is what this file exists to protect: timestamps
 * are copied verbatim from the .srt and never pass through a model. So the model
 * is never shown a timestamp and never writes one. It writes `[2]`, and the
 * renderer resolves that to a time the retrieval layer already knew. A model
 * that hallucinates can therefore cite the WRONG moment, but it cannot invent a
 * moment that does not exist — which is the difference between a citation that
 * is merely imperfect and one that is worthless.
 */

/**
 * One citable unit: a parent segment, timed by its best-ranked chunk.
 *
 * The address is module → chapter → timestamp, because that is how a learner
 * navigates the course folder. `folderName` carries the directory verbatim,
 * since the prettified title drops the number prefix and the `_epm` suffix and
 * therefore does not match what a file browser shows.
 */
export interface Source {
  /** 1-based number the model cites. */
  n: number;
  lessonId: string;
  moduleNum: number;
  /** "Module 4", or "Module 1 (Hitesh)" where two folders share a number. */
  moduleLabel: string;
  /** "Chapter 3" / "Mini-project 1". Empty for unnumbered extras. */
  chapterLabel: string;
  lessonTitle: string;
  /** The lesson directory on disk, e.g. "3-Dynamic Routes_epm". */
  folderName: string;
  /** LLM-written topic for this specific moment, e.g. "Creating the route file". */
  segmentTitle: string;
  instructor: string;
  /**
   * Start of the best-ranked chunk inside this segment — the moment to jump to.
   * The segment is 2-4 minutes; this is the ~60s window retrieval actually hit.
   */
  startMs: number;
  /** Parent segment span, so the UI can show how long the explanation runs. */
  segmentStartMs: number;
  segmentEndMs: number;
  /** Parent segment transcript. Server-side only — never sent to the client. */
  text: string;
}

/**
 * The client-facing half of a Source.
 *
 * Deliberately drops `text`: a segment is 2-4 minutes of transcript, roughly 2kB
 * each, and shipping six of them down the wire to render a card that shows a
 * title and a timestamp would multiply the response size for nothing.
 */
export interface Citation {
  n: number;
  lessonId: string;
  moduleNum: number;
  moduleLabel: string;
  chapterLabel: string;
  lessonTitle: string;
  folderName: string;
  segmentTitle: string;
  instructor: string;
  startMs: number;
  /** Preformatted so the client never re-derives it and drifts. */
  timestamp: string;
}

export function toCitation(source: Source): Citation {
  return {
    n: source.n,
    lessonId: source.lessonId,
    moduleNum: source.moduleNum,
    moduleLabel: source.moduleLabel,
    chapterLabel: source.chapterLabel,
    lessonTitle: source.lessonTitle,
    folderName: source.folderName,
    segmentTitle: source.segmentTitle,
    instructor: source.instructor,
    startMs: source.startMs,
    timestamp: formatTimestamp(source.startMs),
  };
}

/**
 * Pairs each retrieved chunk with its parent segment, one source per segment.
 *
 * Several chunks routinely land in the same segment — they are 60s windows of the
 * same few minutes of speech. Collapsing them means the segment's transcript
 * appears once in the prompt instead of three times, and the learner gets one
 * citation per idea rather than three timestamps 40 seconds apart. The first
 * chunk wins the timestamp because `chunks` arrives in fusion order, so it is the
 * best-ranked window in that segment.
 */
export function buildSources(
  chunks: RetrievedChunk[],
  segments: SegmentContext[],
  lessons: Map<string, LessonRef>,
): Source[] {
  const byId = new Map(segments.map((s) => [s.segmentId, s]));
  const sources: Source[] = [];
  const claimed = new Set<string>();

  for (const chunk of chunks) {
    if (claimed.has(chunk.segmentId)) continue;
    const segment = byId.get(chunk.segmentId);
    if (!segment) continue;

    claimed.add(chunk.segmentId);
    // Lesson labels come from Postgres; the chunk payload is only trusted for
    // what is genuinely chunk-level. Falling back to the payload keeps a
    // citation renderable if a lesson row somehow went missing.
    const lesson = lessons.get(chunk.lessonId);
    sources.push({
      n: sources.length + 1,
      lessonId: chunk.lessonId,
      moduleNum: lesson?.moduleNum ?? chunk.moduleNum,
      moduleLabel: lesson?.moduleLabel ?? `Module ${chunk.moduleNum}`,
      chapterLabel: lesson?.chapterLabel ?? "",
      lessonTitle: lesson?.displayTitle ?? chunk.lessonTitle,
      folderName: lesson?.folderName ?? "",
      segmentTitle: chunk.segmentTitle || segment.title,
      instructor: lesson?.instructor ?? chunk.instructor,
      startMs: chunk.startMs,
      segmentStartMs: segment.startMs,
      segmentEndMs: segment.endMs,
      text: segment.text,
    });
  }

  return sources;
}

/**
 * Renders sources for the answer prompt.
 *
 * Note what is NOT here: any timestamp. A model that sees "12:04" in its context
 * will eventually type "around 12:04" into its answer, and that string bypasses
 * every check in this file. Withholding it makes the citation marker the only
 * way to refer to a moment, which is what makes the marker worth validating.
 */
export function renderSources(sources: Source[]): string {
  return sources
    .map((s) => {
      const chapter = s.chapterLabel
        ? `${s.chapterLabel}: ${s.lessonTitle}`
        : s.lessonTitle;
      return [
        `[${s.n}] ${s.moduleLabel} › ${chapter} — "${s.segmentTitle}" (taught by ${s.instructor})`,
        s.text,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * A `[...]` span longer than this cannot be a citation marker, so the scanner
 * stops holding it back and lets it stream. Guards against a stray `[` freezing
 * output until the end of the response.
 */
const MAX_MARKER_LENGTH = 16;

/** `[3]`, `[1, 2]`, `[2;3]` — digits and separators only. */
const MARKER_BODY = /^\d+(?:\s*[,;]\s*\d+)*$/;

/**
 * Characters that, immediately before a `[`, mean it is subscript rather than a
 * citation: `arr[0]`, `items[1]`, `foo()[0]`. A real citation always follows a
 * space, punctuation, or the start of the text.
 *
 * This is the backstop for indexing written outside a code span, where the
 * code-span exemption below cannot help. Note what is deliberately absent: `]`.
 * Chained indexing (`m[0][1]`) has that shape, but so does `[1][2]` — the exact
 * form the answer prompt asks for when two sources back one sentence — and
 * treating it as subscript left every citation after the first unresolved.
 */
const SUBSCRIPT_PREFIX = /[\w$)]/;

/** Index of the next backtick or `[`, whichever comes first. -1 if neither. */
function nextInteresting(text: string, from: number): number {
  const tick = text.indexOf("`", from);
  const bracket = text.indexOf("[", from);
  if (tick === -1) return bracket;
  if (bracket === -1) return tick;
  return Math.min(tick, bracket);
}

export interface CitationFilter {
  /** Feeds a delta in, returns the text safe to emit now. */
  push(delta: string): string;
  /** Emits anything still held back. Call once, after the stream ends. */
  flush(): string;
  /** Sources the model actually cited, renumbered in order of first use. */
  citations(): Citation[];
}

/**
 * Streaming validator for citation markers.
 *
 * Three jobs, all of which have to happen mid-stream rather than after it, since
 * the text is being written to the user as it arrives:
 *
 *  1. Drop markers that point at nothing. `[9]` against six sources is the model
 *     inventing a reference, and rendering it would send the learner looking for
 *     a citation that does not exist.
 *  2. Renumber what survives by order of first appearance, so the cards below the
 *     answer read 1, 2, 3 rather than 1, 4, 6 with gaps where retrieval ranked
 *     things differently from how the answer used them.
 *  3. Hold back partial markers. A delta boundary falls mid-token often enough
 *     that "[" and "1]" arrive separately; emitting the "[" immediately would
 *     leak a broken marker into the rendered output.
 *
 * And one thing it must NOT do: touch anything inside a code span. The answers
 * contain snippets, and `aspect: [1, 1]` is an array literal that happens to
 * look exactly like a two-source citation.
 */
export function createCitationFilter(sources: Source[]): CitationFilter {
  /** Sources cited so far, in order. Position + 1 is the number shown. */
  const cited: Source[] = [];
  const displayNumbers = new Map<number, number>();
  let buffer = "";
  /** Last character handed to the caller, so the subscript check survives a
   *  delta boundary that lands immediately before a `[`. */
  let lastEmitted = "";
  /** Whether the scanner is inside ``` … ``` or ` … ` right now. */
  let inFence = false;
  let inInline = false;

  function displayNumber(source: Source): number {
    const existing = displayNumbers.get(source.n);
    if (existing !== undefined) return existing;
    cited.push(source);
    displayNumbers.set(source.n, cited.length);
    return cited.length;
  }

  /** Returns the replacement text for a marker body, or null if it isn't one. */
  function resolve(body: string): string | null {
    if (!MARKER_BODY.test(body.trim())) return null;

    return body
      .split(/[,;]/)
      .map((part) => sources[Number(part.trim()) - 1])
      .filter((source): source is Source => source !== undefined)
      .map((source) => `[${displayNumber(source)}]`)
      .join("");
  }

  return {
    push(delta) {
      buffer += delta;
      let out = "";
      let cursor = 0;

      while (cursor < buffer.length) {
        const next = nextInteresting(buffer, cursor);
        if (next === -1) {
          out += buffer.slice(cursor);
          cursor = buffer.length;
          break;
        }

        out += buffer.slice(cursor, next);
        cursor = next;

        if (buffer[cursor] === "`") {
          let end = cursor;
          while (end < buffer.length && buffer[end] === "`") end++;
          // A run touching the end of the buffer may still grow, and a ` that
          // turns out to be a ``` means the opposite thing. Hold until it can't.
          if (end === buffer.length && end - cursor < 3) break;

          const run = end - cursor;
          if (run >= 3) inFence = !inFence;
          else if (!inFence && run % 2 === 1) inInline = !inInline;

          out += buffer.slice(cursor, end);
          cursor = end;
          continue;
        }

        // Inside code, brackets are syntax. `aspect: [1, 1]` is an array
        // literal, and rewriting it to `aspect: [1][2]` produces code that does
        // not run — observed on a real answer, which is why this check exists.
        if (inFence || inInline) {
          out += "[";
          cursor++;
          continue;
        }

        const close = buffer.indexOf("]", cursor);
        if (close === -1) {
          // Still open. Hold it only while it could plausibly close as a marker.
          if (buffer.length - cursor <= MAX_MARKER_LENGTH) break;
          out += "[";
          cursor++;
          continue;
        }

        const before = cursor > 0 ? buffer[cursor - 1] : lastEmitted.slice(-1);
        const replacement = SUBSCRIPT_PREFIX.test(before)
          ? null
          : resolve(buffer.slice(cursor + 1, close));

        if (replacement === null) {
          // Not a citation — markdown links pass through untouched.
          out += buffer.slice(cursor, close + 1);
        } else {
          // A dropped marker usually leaves an orphaned space before it.
          if (replacement === "") out = out.replace(/ $/, "");
          out += replacement;
        }
        cursor = close + 1;
      }

      buffer = buffer.slice(cursor);
      if (out) lastEmitted = out.slice(-1);
      return out;
    },

    flush() {
      // Anything still buffered is an unclosed "[", which is literal text.
      const tail = buffer;
      buffer = "";
      return tail;
    },

    citations() {
      return cited.map((source, i) => ({ ...toCitation(source), n: i + 1 }));
    },
  };
}

/** Pipes a text stream through a filter. The filter stays the caller's, so
 *  `citations()` is readable once the loop finishes. */
export async function* applyCitationFilter(
  stream: AsyncIterable<string>,
  filter: CitationFilter,
): AsyncIterable<string> {
  for await (const delta of stream) {
    const out = filter.push(delta);
    if (out) yield out;
  }
  const tail = filter.flush();
  if (tail) yield tail;
}

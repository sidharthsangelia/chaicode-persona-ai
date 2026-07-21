// Core data shapes for the course RAG pipeline.
//
// The pipeline is a chain of narrowing units:
//   Cue      one subtitle line, ~5s, exactly as it appears in the .srt
//   Segment  a topic block with semantic boundaries, ~2-6min  -> what the LLM reads
//   Chunk    a ~60s window inside a segment                   -> what gets embedded
//
// Invariant that everything else depends on: text and timestamps on Cue are
// copied verbatim from the source file and are never passed through an LLM.
// Models only ever emit cue *indices*, so a hallucination can misgroup a topic
// but can never produce a citation pointing at a timestamp that doesn't exist.

export interface Cue {
  /** 0-based position within the lesson. This is the id models refer to. */
  i: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** How a lesson was labelled in its folder name, which drives sort order. */
export type LessonKind = "chapter" | "mini-project" | "unnumbered";

export interface Lesson {
  /** Stable slug, e.g. "m4-03-dynamic-routes". Safe to use as a DB key. */
  id: string;
  moduleSlug: string;
  moduleNum: number;
  /** Display label, e.g. "Module 4". */
  moduleLabel: string;
  /** Human title with folder-name noise stripped, e.g. "Dynamic Routes". */
  title: string;
  kind: LessonKind;
  /** Number parsed from the folder name; mini-projects sort after chapters. */
  order: number;
  /** Global position across the whole course, assigned after sorting. */
  courseOrder: number;
  instructor: string;
  srtPath: string;
  durationMs: number;
  cueCount: number;
  /** sha256 of the raw .srt — lets re-ingest skip unchanged lessons. */
  contentHash: string;
  /** Reserved for deep links once lesson URLs exist. Null for now. */
  videoUrl: string | null;
}

export interface Segment {
  id: string;
  lessonId: string;
  ordinal: number;
  /** Topic title written by the segmentation model. */
  title: string;
  startCue: number;
  endCue: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface Chunk {
  id: string;
  lessonId: string;
  segmentId: string;
  ordinal: number;
  startCue: number;
  endCue: number;
  startMs: number;
  endMs: number;
  /** Verbatim transcript text for this window. */
  text: string;
  /** One situating sentence from the enrichment model. Empty until enriched. */
  context: string;
  /** API/package/command names pulled out for the keyword leg. */
  tags: string[];
}

/**
 * Lesson-level document, embedded separately from chunks.
 *
 * Gives broad questions ("where do I learn navigation?") something to match
 * that isn't an arbitrary 60-second clip, and carries correct spellings for
 * lessons whose folder names contain typos.
 */
export interface LessonSummary {
  lessonId: string;
  /** Real topic recovered from the transcript; used when the folder name is a
   *  placeholder like "Chapter 2". */
  displayTitle: string;
  summary: string;
  topics: string[];
}

/** A prior turn, used to resolve follow-up questions into standalone ones. */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Renders recent turns for a prompt.
 *
 * Assistant turns are truncated hard: their role here is only to tell the model
 * what "that" and "it" refer to in the next question, and a full grounded answer
 * with citations would crowd out the actual instruction.
 */
export function formatHistory(turns: ChatTurn[], maxTurns = 6): string {
  if (turns.length === 0) return "(no prior conversation)";
  return turns
    .slice(-maxTurns)
    .map((t) => {
      const text = t.role === "assistant" ? t.text.slice(0, 300) : t.text;
      return `${t.role === "user" ? "User" : "Assistant"}: ${text}`;
    })
    .join("\n");
}

/** Folder names that carry no topic information and need a backfilled title. */
export function isPlaceholderTitle(title: string): boolean {
  return /^(chapter|part|mini project|lesson)\s+\d+$/i.test(title.trim());
}

/** Formats ms as the m:ss / h:mm:ss a citation shows the user. */
export function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

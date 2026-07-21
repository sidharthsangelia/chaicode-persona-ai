import { z } from "zod";
import type { CueWindow } from "./chunk";
import { cachedObject, MODELS } from "./llm";
import type { Chunk, Lesson, LessonSummary, Segment } from "./types";
import { formatTimestamp } from "./types";

/**
 * Enrichment exists because spoken language has almost no nouns.
 *
 * A real chunk from this corpus reads: "And this is coming from expo router and
 * yeah, our dynamic route is up and running." Embedded as-is it matches nothing
 * — "this" is the useLocalSearchParams hook, named 40 seconds earlier. The
 * contextual header restores the missing nouns so the chunk is retrievable on
 * its own, which is the whole premise of contextual retrieval.
 *
 * Entity tags serve the keyword leg, and incidentally repair source typos: the
 * folder says "Remainder buddy" but the tags will say "reminder", so a user
 * searching "reminder app" actually finds it.
 */

const chunkEnrichmentSchema = z.object({
  chunks: z.array(
    z.object({
      ordinal: z.number().int().describe("The chunk number being described"),
      context: z
        .string()
        .describe(
          "One sentence situating this clip within the lesson, naming the concrete concept, API, or file being discussed",
        ),
      tags: z
        .array(z.string())
        .describe(
          "Package names, APIs, hooks, components, CLI commands, and concepts mentioned",
        ),
    }),
  ),
});

const ENRICH_SYSTEM = `You write retrieval context for short clips from a React Native / Expo course transcript.

For each numbered clip you receive, produce:

1. "context" — ONE sentence that makes the clip understandable on its own. Spoken transcripts are full of pronouns ("this", "here", "that thing") whose referents appear elsewhere; your sentence must name what they refer to. State the concrete concept, API, hook, component, file, or command involved. Write it as a statement about the clip, e.g. "Explains how useLocalSearchParams reads the postId param inside a dynamic Expo Router route."

2. "tags" — the technical identifiers a learner would search for: package names (expo-router, expo-secure-store), APIs and hooks (useLocalSearchParams, StyleSheet.create), components (FlatList, Pressable), CLI commands (npx expo start, eas build), and concept names (deep linking, OAuth callback).

Rules:
- Use correct spelling for technical terms even when the transcript or lesson title misspells them.
- Never invent APIs or features that are not present in the clip or its surrounding context.
- Return exactly one entry per clip, using the ordinal given.`;

/** Fallback header when the model omits or mismatches a chunk. */
function fallbackContext(lesson: Lesson, segment: Segment): string {
  return `From ${lesson.moduleLabel}, "${lesson.title}" — ${segment.title}.`;
}

/**
 * Generates contextual headers and tags for every chunk in one segment.
 *
 * Batched per segment rather than per chunk for two reasons: it is ~2.5x fewer
 * calls, and the model sees the whole topic block at once, so the header for a
 * clip can reference something established earlier in the same segment.
 */
export async function enrichSegment(
  lesson: Lesson,
  segment: Segment,
  windows: CueWindow[],
): Promise<Chunk[]> {
  const clips = windows
    .map(
      (w, i) =>
        `[clip ${i}] ${formatTimestamp(w.startMs)}-${formatTimestamp(w.endMs)}\n${w.text}`,
    )
    .join("\n\n");

  const prompt = `Course: Expo / React Native mobile development
${lesson.moduleLabel} — Lesson: "${lesson.title}"
Topic block: "${segment.title}" (${formatTimestamp(segment.startMs)}-${formatTimestamp(segment.endMs)})

Full text of this topic block, for context:
${segment.text}

---
Now describe each clip below. Clips are consecutive and overlapping excerpts of the block above.

${clips}`;

  let enriched: Array<{ ordinal: number; context: string; tags: string[] }> =
    [];
  try {
    const { object } = await cachedObject({
      model: MODELS.enrich,
      system: ENRICH_SYSTEM,
      prompt,
      schema: chunkEnrichmentSchema,
      schemaName: "chunkEnrichment.v1",
    });
    enriched = object.chunks;
  } catch {
    // Degrade to metadata-only context rather than dropping the chunks: a
    // slightly weaker header is far better than an unretrievable clip.
    enriched = [];
  }

  // Index by ordinal instead of zipping by position — the model can return
  // entries out of order, duplicated, or short, and a positional zip would
  // silently attach the wrong context to the wrong timestamp.
  const byOrdinal = new Map(enriched.map((e) => [e.ordinal, e]));

  return windows.map((w, i) => {
    const match = byOrdinal.get(i);
    return {
      id: `${segment.id}#c${String(i).padStart(2, "0")}`,
      lessonId: lesson.id,
      segmentId: segment.id,
      ordinal: i,
      startCue: w.startCue,
      endCue: w.endCue,
      startMs: w.startMs,
      endMs: w.endMs,
      text: w.text,
      context: match?.context?.trim() || fallbackContext(lesson, segment),
      tags: (match?.tags ?? [])
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12),
    };
  });
}

const summarySchema = z.object({
  displayTitle: z
    .string()
    .describe("Concise descriptive title for this lesson, max 8 words"),
  summary: z
    .string()
    .describe("2-3 sentences on what the lesson covers and what gets built"),
  topics: z
    .array(z.string())
    .describe("5-10 specific topics, APIs, or packages taught in this lesson"),
});

const SUMMARY_SYSTEM = `You summarize lessons from a React Native / Expo course.

Write for a learner deciding whether this lesson answers their question. Be concrete: name the packages, APIs, and features taught, and say what gets built if it is a project lesson.

The provided lesson title may be a meaningless placeholder ("Chapter 2") or contain typos. Derive "displayTitle" from the transcript content itself and spell technical terms correctly.`;

/**
 * Summarizes a lesson into its own embeddable document.
 *
 * Also recovers a real title: five lessons in this corpus (all of Module 17,
 * plus m15-03) are named only "Chapter N", which makes 2.2 hours of content
 * invisible to any title- or metadata-based retrieval.
 */
export async function summarizeLesson(
  lesson: Lesson,
  segments: Segment[],
): Promise<LessonSummary> {
  const outline = segments
    .map((s) => `- ${formatTimestamp(s.startMs)} ${s.title}`)
    .join("\n");

  const prompt = `${lesson.moduleLabel}
Lesson title as given: "${lesson.title}"
Duration: ${formatTimestamp(lesson.durationMs)}

Topic outline:
${outline}

Full transcript:
${segments.map((s) => s.text).join(" ")}`;

  try {
    const { object } = await cachedObject({
      model: MODELS.summary,
      system: SUMMARY_SYSTEM,
      prompt,
      schema: summarySchema,
      schemaName: "lessonSummary.v1",
    });

    return {
      lessonId: lesson.id,
      displayTitle: object.displayTitle.trim() || lesson.title,
      summary: object.summary.trim(),
      topics: object.topics.map((t) => t.trim()).filter(Boolean),
    };
  } catch {
    return {
      lessonId: lesson.id,
      displayTitle: lesson.title,
      summary: `${lesson.title} — ${lesson.moduleLabel}.`,
      topics: segments.map((s) => s.title),
    };
  }
}

/**
 * Composes the string that actually gets embedded.
 *
 * Header first so the situating nouns lead, then verbatim speech, then tags —
 * which mostly serve the keyword leg but also give the dense vector a second
 * shot at exact API names, where semantic similarity is weakest.
 */
export function buildEmbedText(chunk: Chunk, lesson: Lesson): string {
  const parts = [
    `${lesson.moduleLabel} · ${lesson.title}`,
    chunk.context,
    chunk.text,
  ];
  if (chunk.tags.length) parts.push(chunk.tags.join(", "));
  return parts.join("\n");
}

/** Embeddable text for a lesson-level document. */
export function buildLessonEmbedText(
  lesson: Lesson,
  summary: LessonSummary,
): string {
  return [
    `${lesson.moduleLabel} · ${summary.displayTitle}`,
    summary.summary,
    summary.topics.join(", "),
  ].join("\n");
}

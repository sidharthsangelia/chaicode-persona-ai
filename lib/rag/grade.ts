import { z } from "zod";
import { fastObject, MODELS } from "./llm";
import type { RetrievedChunk } from "./retrieve";
import { formatTimestamp } from "./types";

/**
 * Corrective RAG: judge the retrieved set BEFORE generating an answer.
 *
 * Without this, retrieval failure is indistinguishable from retrieval success
 * at generation time — the model gets some transcript, and a fluent model will
 * write a confident answer from irrelevant transcript. Grading turns that
 * silent failure into either a retry with better queries, or an honest "the
 * course doesn't cover this", which for a course assistant is a correct answer
 * rather than a defeat.
 *
 * One call does two jobs: scoring the set, and marking which individual chunks
 * are actually relevant. Per-document grading is the textbook formulation but
 * costs N calls; asking for indices gets the same filtering for one.
 */

/** At or above this, the retrieved set can answer the question outright. */
export const SUFFICIENCY_THRESHOLD = 6;

/**
 * At or above this, the set is on the right topic even though it does not fully
 * answer — and is still worth citing.
 *
 * Treating sufficiency as a single boolean threw away good citations. Asked
 * "which is better, Pressable or TouchableOpacity", retrieval correctly surfaced
 * three clips from Module 2 that teach Pressable, and the grader scored them 4:
 * the course demonstrates both components but never delivers a head-to-head
 * verdict, so the excerpts genuinely do not answer the question as asked. Below
 * the threshold, those clips were dropped and the learner got a general answer
 * with no timestamps — despite the course covering the topic at 9:23.
 *
 * 4-5 is exactly the band the grading rubric calls "the right topic area, but the
 * specific thing asked is not shown". The right response there is to answer from
 * the mentor's own knowledge AND point at what the course does teach, not to
 * pretend the course has nothing.
 */
export const RELEVANCE_THRESHOLD = 4;

/**
 * How well the retrieved set covers the question.
 *
 *   full     answer from the excerpts and cite them
 *   partial  right topic, incomplete answer — explain it, still cite
 *   none     nothing usable; say so
 */
export type Coverage = "full" | "partial" | "none";

export interface RetrievalGrade {
  /** 0-10: how well the retrieved set covers the question. */
  score: number;
  reasoning: string;
  /** What the set is missing. Drives the retry query; empty when covered. */
  missing: string;
  /** Indices into the graded array that are genuinely relevant. */
  relevantIndices: number[];
  coverage: Coverage;
  /** True when grading failed and the score was assumed rather than judged. */
  degraded?: boolean;
}

function coverageOf(score: number): Coverage {
  if (score >= SUFFICIENCY_THRESHOLD) return "full";
  return score >= RELEVANCE_THRESHOLD ? "partial" : "none";
}

const gradeSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(10)
    .describe("0-10: how completely these excerpts answer the question"),
  reasoning: z.string().describe("One sentence explaining the score"),
  missing: z
    .string()
    .describe("What is absent that would be needed; empty string if nothing"),
  relevantIndices: z
    .array(z.number().int())
    .describe("Indices of excerpts genuinely relevant to the question"),
});

const SYSTEM = `You judge whether retrieved course-transcript excerpts can answer a learner's question.

Score 0-10 on how completely the excerpts cover the question:
  0-3  nothing relevant, or only superficially related material
  4-5  the right topic area, but the specific thing asked is not shown
  6-7  the question can be answered, though some detail is thin
  8-10 the excerpts clearly and directly cover it

Judge only what the excerpts contain. Do NOT use your own knowledge of React Native or Expo to fill gaps — an excerpt that merely mentions a topic is not the same as one that explains it.

"missing" — name concretely what is absent (a specific API, a step, a configuration) so a follow-up search can target it. Empty string when the excerpts fully cover the question.

"relevantIndices" — every excerpt that genuinely bears on the question. Be selective: including a marginal excerpt puts noise into the final answer. Empty array if none qualify.

This is a transcript of someone speaking while screen-sharing, so it is informal and repetitive. Judge substance, not polish.`;

/**
 * Compact rendering of a chunk for grading.
 *
 * The enrichment header plus a truncated quote is enough to judge relevance,
 * and costs roughly a third of the full text — grading sits directly in the
 * user's latency budget, so tokens here are latency.
 */
function renderForGrading(chunk: RetrievedChunk, index: number): string {
  return [
    `[${index}] Module ${chunk.moduleNum} · ${chunk.lessonTitle} · ${formatTimestamp(chunk.startMs)}`,
    `topic: ${chunk.segmentTitle}`,
    `about: ${chunk.context}`,
    `said: ${chunk.text.slice(0, 400)}`,
  ].join("\n");
}

export async function gradeRetrieval(
  question: string,
  chunks: RetrievedChunk[],
  signal?: AbortSignal,
): Promise<RetrievalGrade> {
  if (chunks.length === 0) {
    return {
      score: 0,
      reasoning: "no results retrieved",
      missing: question,
      relevantIndices: [],
      coverage: "none",
    };
  }

  try {
    const result = await fastObject({
      model: MODELS.grade,
      system: SYSTEM,
      prompt: `Question: ${question}

Excerpts:
${chunks.map(renderForGrading).join("\n\n")}`,
      schema: gradeSchema,
      signal,
      maxOutputTokens: 300,
      temperature: 0,
    });

    // The model can return indices that do not exist; a stale index would drop
    // the wrong chunk or crash the caller.
    const relevantIndices = [...new Set(result.relevantIndices)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < chunks.length)
      .sort((a, b) => a - b);

    return {
      score: result.score,
      reasoning: result.reasoning,
      missing: result.missing.trim(),
      relevantIndices,
      // A score in the partial band with nothing marked relevant is really a
      // miss: the grader looked and could not point at anything.
      coverage:
        relevantIndices.length === 0 && result.score < SUFFICIENCY_THRESHOLD
          ? "none"
          : coverageOf(result.score),
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("[grade] scoring failed, assuming sufficient:", error);
    // Fail open. A grading outage should not turn a working assistant into one
    // that refuses everything; the citation check still guards the output.
    return {
      score: SUFFICIENCY_THRESHOLD,
      reasoning: "grader unavailable",
      missing: "",
      relevantIndices: chunks.map((_, i) => i),
      coverage: "full",
      degraded: true,
    };
  }
}

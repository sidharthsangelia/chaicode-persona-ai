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

/** Below this, the retrieved set is not good enough to answer from. */
export const SUFFICIENCY_THRESHOLD = 6;

export interface RetrievalGrade {
  /** 0-10: how well the retrieved set covers the question. */
  score: number;
  reasoning: string;
  /** What the set is missing. Drives the retry query; empty when covered. */
  missing: string;
  /** Indices into the graded array that are genuinely relevant. */
  relevantIndices: number[];
  sufficient: boolean;
  /** True when grading failed and the score was assumed rather than judged. */
  degraded?: boolean;
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
      sufficient: false,
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
      sufficient: result.score >= SUFFICIENCY_THRESHOLD,
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
      sufficient: true,
      degraded: true,
    };
  }
}

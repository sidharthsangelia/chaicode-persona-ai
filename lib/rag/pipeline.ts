import { gradeRetrieval, type RetrievalGrade } from "./grade";
import {
  expandToSegments,
  getCourseOutline,
  hybridSearch,
  type LessonRef,
  loadLessonRefs,
  type QuerySpec,
  type RetrievedChunk,
  rrfFuse,
  type SegmentContext,
} from "./retrieve";
import { type RouteDecision, routeQuery } from "./router";
import {
  QUERY_WEIGHTS,
  refineQueries,
  type TransformedQuery,
  toQuerySpecs,
  transformQuery,
} from "./transform";
import type { ChatTurn } from "./types";

/**
 * The retrieval pipeline, end to end.
 *
 *   route ─┐
 *          ├─ (parallel) ─→ retrieve ─→ grade ─→ [retry once] ─→ expand
 *   transform ─┘
 *
 * Route and transform run concurrently because transform never reads the route.
 * That costs a wasted transform whenever the route turns out not to be COURSE —
 * now the common case, since ordinary technical questions are answered from the
 * model's own knowledge unless the learner asked for the course. It stays worth
 * it: the transform runs in parallel so it adds no latency to the routes that
 * discard it, and it saves ~1.4s on every question that does hit retrieval.
 */

export interface StageTiming {
  stage: string;
  ms: number;
}

/**
 * Progress events, emitted as each stage completes.
 *
 * This exists so the chat route can stream honest status to the UI ("searching
 * modules 4 and 6…", "checking the results…") instead of showing a spinner for
 * eight seconds. Building it in now means the streaming layer is pure wiring.
 */
export type PipelineEvent =
  | { type: "routed"; route: RouteDecision }
  | { type: "transformed"; transformed: TransformedQuery }
  | { type: "retrieved"; attempt: number; count: number; modules: number[] }
  | { type: "graded"; attempt: number; score: number; sufficient: boolean }
  | { type: "retrying"; queries: string[] };

export interface PipelineOptions {
  history?: ChatTurn[];
  /**
   * The learner turned course mode on with /course, so every answer should be
   * grounded in the transcripts. Narrows routing rather than skipping it — the
   * router is also the injection guardrail, and an explicit mode must not become
   * a way around it.
   */
  courseMode?: boolean;
  /** Chunks handed to the answer step. */
  limit?: number;
  /** Total retrieval attempts. 2 means one corrective retry. */
  maxAttempts?: number;
  signal?: AbortSignal;
  onEvent?: (event: PipelineEvent) => void;
}

export interface PipelineResult {
  route: RouteDecision;
  transformed: TransformedQuery | null;
  /** Populated for CATALOG questions instead of chunks. */
  outline: string | null;
  chunks: RetrievedChunk[];
  segments: SegmentContext[];
  /** Module/chapter/folder labels for the cited lessons, keyed by lesson id. */
  lessons: Map<string, LessonRef>;
  grade: RetrievalGrade | null;
  attempts: number;
  /**
   * False when retrieval never cleared the bar. The answer step must say so
   * rather than confabulating from whatever was returned.
   */
  sufficient: boolean;
  timings: StageTiming[];
  totalMs: number;
}

const DEFAULTS = { limit: 6, maxAttempts: 2 } as const;
/** Pulled per list before fusion; wider than `limit` so fusion has room to work. */
const PER_LEG = 20;

/**
 * Only retry when the score lands in the middle band.
 *
 * A retry is worth ~3.8s (refine + retrieve + re-grade), and it pays off when
 * the corpus DOES cover the topic but the first queries missed the angle —
 * scores around 3-5. Below that, the signature is different: "how do I add
 * in-app purchases with RevenueCat" scored 1/10 with hits scattered across
 * modules 5, 7, 13 and 14, which is what "this subject is simply not in the
 * course" looks like. No rewording fixes an absent topic, so retrying there
 * spends four seconds to arrive at the same honest answer.
 *
 * The trade: a genuinely bad first transform that tanks an answerable question
 * to 0-2 loses its second chance. That is rarer than the absent-topic case, and
 * the step-back query means a covered topic almost always surfaces its own
 * subject area at some score above this floor.
 */
const RETRY_SCORE_FLOOR = 3;

/** Chunks passed on when retrieval failed — enough to offer the nearest thing. */
const INSUFFICIENT_LIMIT = 3;

/** Times an async stage and records it. */
async function timed<T>(
  timings: StageTiming[],
  stage: string,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timings.push({ stage, ms: Date.now() - started });
  }
}

function emptyResult(
  route: RouteDecision,
  transformed: TransformedQuery | null,
  timings: StageTiming[],
  startedAt: number,
  outline: string | null = null,
): PipelineResult {
  return {
    route,
    transformed,
    outline,
    chunks: [],
    segments: [],
    lessons: new Map(),
    grade: null,
    attempts: 0,
    sufficient: true,
    timings,
    totalMs: Date.now() - startedAt,
  };
}

export async function runRetrievalPipeline(
  question: string,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const {
    history = [],
    courseMode = false,
    limit = DEFAULTS.limit,
    maxAttempts = DEFAULTS.maxAttempts,
    signal,
    onEvent,
  } = options;

  const startedAt = Date.now();
  const timings: StageTiming[] = [];

  // Both calls are independent, so they start together — but only COURSE ever
  // reads the transform. Awaiting them as a pair would make every greeting wait
  // on work it discards, so the transform is left in flight and awaited later.
  const transformPromise = transformQuery(question, history, signal);
  // A floating promise that rejects is an unhandled rejection; absorb it here
  // and let the await below surface the real error if we actually need it.
  transformPromise.catch(() => {});

  const route = await timed(timings, "route", () =>
    routeQuery(question, { history, courseMode, signal }),
  );

  onEvent?.({ type: "routed", route });

  if (route.route === "REFUSE" || route.route === "GENERAL") {
    return emptyResult(route, null, timings, startedAt);
  }

  if (route.route === "CATALOG") {
    const outline = await timed(timings, "outline", () => getCourseOutline());
    return emptyResult(route, null, timings, startedAt, outline);
  }

  // Usually already resolved by now, since it started alongside routing.
  const transformed = await timed(timings, "transform", () => transformPromise);

  onEvent?.({ type: "transformed", transformed });

  const filter = route.moduleHint ? { moduleNum: route.moduleHint } : undefined;
  const specs = toQuerySpecs(transformed);
  const triedQueries = specs.map((s) => s.text);

  let results = await timed(timings, "retrieve.1", () =>
    hybridSearch(specs, { perLeg: PER_LEG, limit: limit * 2, filter, signal }),
  );

  onEvent?.({
    type: "retrieved",
    attempt: 1,
    count: results.length,
    modules: [...new Set(results.map((c) => c.moduleNum))].sort(
      (a, b) => a - b,
    ),
  });

  let grade = await timed(timings, "grade.1", () =>
    gradeRetrieval(transformed.standalone, results, signal),
  );

  onEvent?.({
    type: "graded",
    attempt: 1,
    score: grade.score,
    sufficient: grade.sufficient,
  });

  // Corrective loop. Bounded hard: each additional attempt costs a refine, a
  // retrieval and a re-grade — roughly 3s — and an unbounded loop would blow
  // any request budget on exactly the questions the corpus cannot answer.
  for (
    let attempt = 2;
    attempt <= maxAttempts &&
    !grade.sufficient &&
    grade.score >= RETRY_SCORE_FLOOR;
    attempt++
  ) {
    const refined = await timed(timings, `refine.${attempt}`, () =>
      refineQueries(
        transformed.standalone,
        grade.missing,
        triedQueries,
        signal,
      ),
    );

    // No new angles means retrying would re-run the same search for the same
    // results — stop and report insufficiency honestly instead.
    if (refined.length === 0) break;

    onEvent?.({ type: "retrying", queries: refined });
    triedQueries.push(...refined);

    const retrySpecs: QuerySpec[] = refined.map((text, i) => ({
      text,
      legs: ["dense", "keyword"] as const,
      weight: QUERY_WEIGHTS.subQuestion,
      label: `retry${attempt - 1}.${i + 1}`,
    }));

    const retryResults = await timed(timings, `retrieve.${attempt}`, () =>
      hybridSearch(retrySpecs, {
        perLeg: PER_LEG,
        limit: limit * 2,
        filter,
        signal,
      }),
    );

    // Fuse across attempts rather than replacing: the first pass is rarely
    // worthless, it was just incomplete, and RRF over the two rankings keeps
    // whatever both passes agree on at the top.
    results = rrfFuse([results, retryResults], {
      labels: ["pass1", "pass2"],
    }).slice(0, limit * 2);

    onEvent?.({
      type: "retrieved",
      attempt,
      count: results.length,
      modules: [...new Set(results.map((c) => c.moduleNum))].sort(
        (a, b) => a - b,
      ),
    });

    grade = await timed(timings, `grade.${attempt}`, () =>
      gradeRetrieval(transformed.standalone, results, signal),
    );

    onEvent?.({
      type: "graded",
      attempt,
      score: grade.score,
      sufficient: grade.sufficient,
    });
  }

  // Drop chunks the grader judged irrelevant — noise in the prompt costs answer
  // quality. When it marked none, what happens next depends on WHY: a passing
  // grade means it simply did not bother narrowing, so keep the ranking; a
  // failing grade means it looked and found nothing, so sending six irrelevant
  // excerpts would only invite the model to answer from them anyway.
  const relevant =
    grade.relevantIndices.length > 0
      ? grade.relevantIndices.map((i) => results[i]).filter(Boolean)
      : results;

  const chunks = relevant.slice(
    0,
    grade.sufficient ? limit : Math.min(limit, INSUFFICIENT_LIMIT),
  );

  // Independent lookups against the same database, so they go together rather
  // than costing two sequential round trips to Singapore.
  const [segments, lessons] = await timed(timings, "expand", () =>
    Promise.all([
      expandToSegments(chunks),
      loadLessonRefs(chunks.map((c) => c.lessonId)),
    ]),
  );

  return {
    route,
    transformed,
    outline: null,
    chunks,
    segments,
    lessons,
    grade,
    attempts: timings.filter((t) => t.stage.startsWith("retrieve.")).length,
    sufficient: grade.sufficient,
    timings,
    totalMs: Date.now() - startedAt,
  };
}

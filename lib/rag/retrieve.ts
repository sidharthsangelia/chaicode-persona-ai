import { prisma } from "@/lib/prisma";
import { embedTexts } from "./embed";
import {
  CHUNK_COLLECTION,
  type ChunkPayload,
  LESSON_COLLECTION,
  qdrant,
} from "./qdrant";
import { formatTimestamp } from "./types";

/**
 * Hybrid retrieval: a dense leg (Qdrant, cosine over embeddings) and a keyword
 * leg (Postgres tsvector, BM25-ish ranking), fused with Reciprocal Rank Fusion.
 *
 * The two legs fail in opposite directions, which is the entire point of
 * running both. Dense search understands that "how do I save data on the phone"
 * means AsyncStorage without either phrase matching. Keyword search nails exact
 * identifiers like `useLocalSearchParams` or `expo-secure-store`, where an
 * embedding of a rare token is close to noise.
 */

export interface RetrievedChunk {
  chunkId: string;
  lessonId: string;
  segmentId: string;
  moduleNum: number;
  moduleSlug: string;
  instructor: string;
  lessonTitle: string;
  segmentTitle: string;
  startMs: number;
  endMs: number;
  text: string;
  context: string;
  tags: string[];
  /** Which legs found this, and where each ranked it. For debugging and the CLI. */
  denseRank?: number;
  denseScore?: number;
  keywordRank?: number;
  keywordScore?: number;
  /**
   * Labels of the queries that surfaced this chunk, e.g. ["standalone", "hyde"].
   * Multi-query retrieval is otherwise opaque — this is what makes it possible to
   * see that HyDE is pulling its weight, or that step-back is only adding noise.
   */
  matchedBy: string[];
  /** Fused score. Only meaningful relative to other results in the same fusion. */
  rrf: number;
}

export interface RetrievalFilter {
  moduleNum?: number;
  instructor?: string;
  lessonId?: string;
}

function toQdrantFilter(filter?: RetrievalFilter) {
  if (!filter) return undefined;
  const must: Array<Record<string, unknown>> = [];
  if (filter.moduleNum !== undefined) {
    must.push({ key: "moduleNum", match: { value: filter.moduleNum } });
  }
  if (filter.instructor) {
    must.push({ key: "instructor", match: { value: filter.instructor } });
  }
  if (filter.lessonId) {
    must.push({ key: "lessonId", match: { value: filter.lessonId } });
  }
  return must.length ? { must } : undefined;
}

function fromPayload(payload: ChunkPayload, rrf = 0): RetrievedChunk {
  return {
    chunkId: payload.chunkId,
    lessonId: payload.lessonId,
    segmentId: payload.segmentId,
    moduleNum: payload.moduleNum,
    moduleSlug: payload.moduleSlug,
    instructor: payload.instructor,
    lessonTitle: payload.lessonTitle,
    segmentTitle: payload.segmentTitle,
    startMs: payload.startMs,
    endMs: payload.endMs,
    text: payload.text,
    context: payload.context,
    tags: payload.tags ?? [],
    matchedBy: [],
    rrf,
  };
}

/** Dense leg: cosine similarity over chunk embeddings in Qdrant. */
export async function denseSearch(
  vector: number[],
  limit: number,
  filter?: RetrievalFilter,
): Promise<RetrievedChunk[]> {
  const res = await qdrant().search(CHUNK_COLLECTION, {
    vector,
    limit,
    with_payload: true,
    filter: toQdrantFilter(filter),
  });

  return res.map((point, i) => ({
    ...fromPayload(point.payload as unknown as ChunkPayload),
    denseRank: i,
    denseScore: point.score,
  }));
}

/**
 * Builds an OR-joined tsquery from free-form user text.
 *
 * websearch_to_tsquery and plainto_tsquery both AND every term, which is fatal
 * here: "how do I read the id from a dynamic route" becomes
 * 'read' & 'id' & 'dynam' & 'rout', and no single 60-second chunk contains all
 * four stems, so the keyword leg silently returns nothing and the hybrid search
 * quietly degrades to dense-only.
 *
 * ORing the terms makes the leg recall-oriented, and ts_rank still grades by how
 * many terms matched, so chunks hitting more of the query rank higher. Precision
 * comes from the dense leg and from RRF preferring documents both legs agree on.
 *
 * Only [a-z0-9] runs survive tokenization, so nothing reaching to_tsquery can be
 * read as query syntax. Postgres drops stopwords itself, which is why an empty
 * result is possible and must be handled by the caller.
 */
export function toOrTsQuery(query: string): string {
  return (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(" | ");
}

/** Keyword leg: Postgres full-text ranking over the generated tsvector. */
export async function keywordSearch(
  query: string,
  limit: number,
  filter?: RetrievalFilter,
): Promise<RetrievedChunk[]> {
  const tsquery = toOrTsQuery(query);
  // All-stopword or punctuation-only input yields an empty tsquery, which
  // matches nothing — skip the round trip rather than issue a useless query.
  if (!tsquery) return [];

  const conditions: string[] = [`c."tsv" @@ q`];
  const params: unknown[] = [tsquery, limit];

  if (filter?.moduleNum !== undefined) {
    params.push(filter.moduleNum);
    conditions.push(`l."moduleNum" = $${params.length}`);
  }
  if (filter?.instructor) {
    params.push(filter.instructor);
    conditions.push(`l."instructor" = $${params.length}`);
  }
  if (filter?.lessonId) {
    params.push(filter.lessonId);
    conditions.push(`c."lessonId" = $${params.length}`);
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      chunkId: string;
      lessonId: string;
      segmentId: string;
      moduleNum: number;
      moduleSlug: string;
      instructor: string;
      lessonTitle: string;
      segmentTitle: string;
      startMs: number;
      endMs: number;
      text: string;
      context: string;
      tags: string[];
      rank: number;
    }>
  >(
    `SELECT c.id            AS "chunkId",
            c."lessonId"    AS "lessonId",
            c."segmentId"   AS "segmentId",
            l."moduleNum"   AS "moduleNum",
            l."moduleSlug"  AS "moduleSlug",
            l."instructor"  AS "instructor",
            l."displayTitle" AS "lessonTitle",
            s."title"       AS "segmentTitle",
            c."startMs"     AS "startMs",
            c."endMs"       AS "endMs",
            c."text"        AS "text",
            c."context"     AS "context",
            c."tags"        AS "tags",
            ts_rank(c."tsv", q) AS "rank"
       FROM "CourseChunk" c
       JOIN "CourseLesson" l  ON l.id = c."lessonId"
       JOIN "CourseSegment" s ON s.id = c."segmentId",
            to_tsquery('english', $1) q
      WHERE ${conditions.join(" AND ")}
      ORDER BY "rank" DESC
      LIMIT $2`,
    ...params,
  );

  return rows.map((row, i) => ({
    chunkId: row.chunkId,
    lessonId: row.lessonId,
    segmentId: row.segmentId,
    moduleNum: row.moduleNum,
    moduleSlug: row.moduleSlug,
    instructor: row.instructor,
    lessonTitle: row.lessonTitle,
    segmentTitle: row.segmentTitle,
    startMs: row.startMs,
    endMs: row.endMs,
    text: row.text,
    context: row.context,
    tags: row.tags ?? [],
    matchedBy: [],
    keywordRank: i,
    keywordScore: Number(row.rank),
    rrf: 0,
  }));
}

/**
 * Reciprocal Rank Fusion.
 *
 *   score(d) = sum over lists of  weight / (K + rank(d))
 *
 * RRF uses only a document's POSITION in each list, never its score. That is
 * the whole trick: a cosine similarity of 0.83 and a ts_rank of 0.0004 live on
 * incomparable scales, and normalizing them would require knowing the
 * distribution of both. Ranks are always comparable.
 *
 * K dampens the top of each list. With K=60, rank 0 contributes 1/60 and rank 1
 * contributes 1/61 — nearly equal — so a document found by BOTH legs at middling
 * rank outscores one found by a single leg at rank 0. That agreement bias is the
 * property we actually want.
 *
 * Weights exist because unweighted RRF has a blind spot, observed directly on
 * this corpus: for "make the phone vibrate when user taps", the correct Haptics
 * clip was found by dense alone at rank 0, and a wrong Notifications clip was
 * found by keyword alone at rank 0 — matching on "phone", "user", "tap". Both
 * scored exactly 1/60 and tied. A rank-0 hit from a noisy leg should not equal a
 * rank-0 hit from a reliable one, so each leg gets a trust weight.
 */
export const RRF_K = 60;

/**
 * Dense is the more reliable leg for conversational questions; the keyword leg
 * earns its place on exact identifiers ("expo-secure-store", "useLocalSearchParams")
 * where an embedding of a rare token is close to noise. Downweighting keyword
 * keeps that benefit while stopping common-word matches from dominating.
 */
export const DENSE_WEIGHT = 1.0;
export const KEYWORD_WEIGHT = 0.5;

export interface FusionOptions {
  k?: number;
  /** Per-list trust weights, positionally matched to `lists`. Defaults to 1. */
  weights?: number[];
  /** Per-list provenance labels, positionally matched to `lists`. */
  labels?: string[];
}

export function rrfFuse(
  lists: RetrievedChunk[][],
  options: FusionOptions = {},
): RetrievedChunk[] {
  const { k = RRF_K, weights = [], labels = [] } = options;
  const merged = new Map<string, RetrievedChunk>();

  lists.forEach((list, listIndex) => {
    const weight = weights[listIndex] ?? 1;
    const label = labels[listIndex];

    list.forEach((item, rank) => {
      const contribution = weight / (k + rank);
      const existing = merged.get(item.chunkId);

      if (!existing) {
        merged.set(item.chunkId, {
          ...item,
          matchedBy: label ? [label] : [],
          rrf: contribution,
        });
        return;
      }

      existing.rrf += contribution;
      if (label && !existing.matchedBy.includes(label)) {
        existing.matchedBy.push(label);
      }
      // Keep whichever leg's diagnostics are present, so the CLI can show that
      // a result was found by both and where each ranked it. Best rank wins,
      // since a later list finding it deeper says nothing about the earlier hit.
      if (
        item.denseRank !== undefined &&
        (existing.denseRank === undefined ||
          item.denseRank < existing.denseRank)
      ) {
        existing.denseRank = item.denseRank;
        existing.denseScore = item.denseScore;
      }
      if (
        item.keywordRank !== undefined &&
        (existing.keywordRank === undefined ||
          item.keywordRank < existing.keywordRank)
      ) {
        existing.keywordRank = item.keywordRank;
        existing.keywordScore = item.keywordScore;
      }
    });
  });

  return [...merged.values()].sort((a, b) => b.rrf - a.rrf);
}

export type RetrievalLeg = "dense" | "keyword";

/**
 * One generated query and how much to trust it.
 *
 * Not every query belongs in every leg. A HyDE passage is a paragraph of
 * hypothetical prose; OR-joining its ~40 terms into the keyword leg would
 * reproduce exactly the common-word noise that weighting had to fix, so it runs
 * dense-only. Weights then encode that the user's actual question is worth more
 * than a broadened restatement of it.
 */
export interface QuerySpec {
  text: string;
  legs: ReadonlyArray<RetrievalLeg>;
  /** Trust multiplier applied on top of the per-leg weight. */
  weight: number;
  /** Provenance label, propagated to RetrievedChunk.matchedBy. */
  label: string;
}

const BOTH_LEGS: ReadonlyArray<RetrievalLeg> = ["dense", "keyword"];

function normalizeSpecs(
  queries: ReadonlyArray<string | QuerySpec>,
): QuerySpec[] {
  return queries
    .map((q, i) =>
      typeof q === "string"
        ? { text: q, legs: BOTH_LEGS, weight: 1, label: `q${i + 1}` }
        : q,
    )
    .filter((spec) => spec.text.trim().length > 0);
}

export interface HybridOptions {
  /** How many to pull from EACH list before fusing. */
  perLeg?: number;
  /** How many fused results to return. */
  limit?: number;
  filter?: RetrievalFilter;
  /**
   * Cancels the embedding request and stops before issuing searches. Neither
   * the Qdrant client nor Prisma accepts an AbortSignal, so in-flight searches
   * still complete — this bounds wasted work rather than eliminating it.
   */
  signal?: AbortSignal;
}

/**
 * Runs every query through its configured legs and fuses the lot into one
 * ranking.
 *
 * All searches are issued in parallel, so N queries cost roughly one round trip
 * rather than N — which is what makes multi-query retrieval affordable inside a
 * request budget.
 */
export async function hybridSearch(
  queries: ReadonlyArray<string | QuerySpec>,
  options: HybridOptions = {},
): Promise<RetrievedChunk[]> {
  const { perLeg = 20, limit = 8, filter, signal } = options;

  const specs = normalizeSpecs(queries);
  if (specs.length === 0) return [];

  const denseSpecs = specs.filter((s) => s.legs.includes("dense"));
  const keywordSpecs = specs.filter((s) => s.legs.includes("keyword"));

  // One batched embedding request for every dense query.
  const vectors = denseSpecs.length
    ? await embedTexts(
        denseSpecs.map((s) => s.text),
        { signal },
      )
    : [];

  signal?.throwIfAborted();

  const lists = await Promise.all([
    ...denseSpecs.map((_, i) => denseSearch(vectors[i], perLeg, filter)),
    ...keywordSpecs.map((s) => keywordSearch(s.text, perLeg, filter)),
  ]);

  // These three arrays are positionally aligned with `lists` by construction.
  const weights = [
    ...denseSpecs.map((s) => s.weight * DENSE_WEIGHT),
    ...keywordSpecs.map((s) => s.weight * KEYWORD_WEIGHT),
  ];
  const labels = [
    ...denseSpecs.map((s) => s.label),
    ...keywordSpecs.map((s) => s.label),
  ];

  return rrfFuse(lists, { weights, labels }).slice(0, limit);
}

export interface SegmentContext {
  segmentId: string;
  lessonId: string;
  title: string;
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Expands retrieved chunks to their parent segments.
 *
 * This is the small-to-big step: the chunk gives the citation its precise
 * timestamp, but the segment is what the answering model reads, so it has
 * enough context to explain rather than parrot a fragment.
 */
export async function expandToSegments(
  chunks: RetrievedChunk[],
): Promise<SegmentContext[]> {
  const ids = [...new Set(chunks.map((c) => c.segmentId))];
  if (ids.length === 0) return [];

  const segments = await prisma.courseSegment.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      lessonId: true,
      title: true,
      startMs: true,
      endMs: true,
      text: true,
    },
  });

  // Preserve fusion order — the first segment is the best-ranked hit, and
  // position in the prompt matters to the answering model.
  const byId = new Map(segments.map((s) => [s.id, s]));
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      segmentId: s.id,
      lessonId: s.lessonId,
      title: s.title,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    }));
}

/**
 * Compact outline of the whole course, for CATALOG-routed questions.
 *
 * "What's in module 5" and "how long is the course" are answered from structure,
 * not from transcripts. The entire outline is ~1k tokens, so handing it over
 * whole is both cheaper and more accurate than retrieving clips and hoping the
 * shape of the course can be inferred from them.
 */
export async function getCourseOutline(): Promise<string> {
  const lessons = await prisma.courseLesson.findMany({
    orderBy: { courseOrder: "asc" },
    select: {
      moduleNum: true,
      moduleLabel: true,
      displayTitle: true,
      durationMs: true,
      instructor: true,
    },
  });

  const totalMs = lessons.reduce((n, l) => n + l.durationMs, 0);
  const lines: string[] = [
    `Course: Expo / React Native mobile development`,
    `${lessons.length} lessons across ${new Set(lessons.map((l) => l.moduleNum)).size} modules, ${(totalMs / 3_600_000).toFixed(1)} hours total`,
    "",
  ];

  let currentModule = -1;
  for (const l of lessons) {
    if (l.moduleNum !== currentModule) {
      currentModule = l.moduleNum;
      lines.push(`${l.moduleLabel}:`);
    }
    lines.push(`  - ${l.displayTitle} (${formatTimestamp(l.durationMs)})`);
  }

  return lines.join("\n");
}

export interface RetrievedLesson {
  lessonId: string;
  moduleNum: number;
  displayTitle: string;
  summary: string;
  topics: string[];
  durationMs: number;
  score: number;
}

/**
 * Lesson-level search over the summary documents.
 *
 * Broad questions ("where do I learn navigation?") want a lesson, not an
 * arbitrary 60-second clip. This is also the coarse destination the router can
 * send catalog-shaped questions to.
 */
export async function lessonSearch(
  query: string,
  limit = 5,
): Promise<RetrievedLesson[]> {
  const [vector] = await embedTexts([query]);

  const res = await qdrant().search(LESSON_COLLECTION, {
    vector,
    limit,
    with_payload: true,
  });

  return res.map((point) => {
    const p = point.payload as Record<string, unknown>;
    return {
      lessonId: String(p.lessonId),
      moduleNum: Number(p.moduleNum),
      displayTitle: String(p.displayTitle),
      summary: String(p.summary),
      topics: (p.topics as string[]) ?? [],
      durationMs: Number(p.durationMs),
      score: point.score,
    };
  });
}

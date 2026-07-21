import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { z } from "zod";

/**
 * Model choices, measured rather than assumed (see docs: benchmark on
 * m4-03-dynamic-routes, 88 cues).
 *
 * gpt-5-nano is a REASONING model: it burned 2,624 hidden reasoning tokens and
 * 20.3s on one lesson, and reasoning tokens bill as output. Setting
 * reasoningEffort:"minimal" cut it to 1.4s but it stopped doing the task at all
 * (returned a single boundary). gpt-4.1-nano does the same job in 1.7s for
 * $0.02 across the whole course, so it wins on every axis that matters here.
 */
export const MODELS = {
  /** Topic boundary detection over numbered cues. */
  segment: "gpt-4.1-nano",
  /** Contextual headers + entity tags, ~600 calls. Latency-sensitive by volume. */
  enrich: "gpt-4.1-nano",
  /** One per lesson, reads a whole transcript. */
  summary: "gpt-4.1-nano",

  // Query-time models sit in the user's latency budget, so the 20s reasoning
  // model measured during ingest is disqualified outright regardless of cost.
  /** 4-way route + guardrail classification. Small output, must be fast. */
  route: "gpt-4.1-nano",
  /** Step-back, sub-questions, HyDE. */
  transform: "gpt-4.1-nano",
  /** Corrective grading of the retrieved set, plus the retry query refinement. */
  grade: "gpt-4.1-nano",
} as const;

const CACHE_DIR = ".rag-cache";

/**
 * On-disk cache for model responses, keyed by the exact inputs.
 *
 * The point is iteration economics: re-running ingest after a chunker tweak
 * shouldn't repay for enrichment. Any change to the prompt, model, or schema
 * shape produces a different key and re-runs naturally, so there's no manual
 * invalidation to forget.
 */
function cachePath(key: string): string {
  return join(CACHE_DIR, key.slice(0, 2), `${key}.json`);
}

function readCache<T>(key: string): T | null {
  try {
    return JSON.parse(readFileSync(cachePath(key), "utf8")) as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  const path = cachePath(key);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

export interface CachedObjectArgs<T> {
  model: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Distinguishes cache entries whose prompts collide but shapes differ. */
  schemaName: string;
  system?: string;
  maxRetries?: number;
}

export interface CachedObjectResult<T> {
  object: T;
  cached: boolean;
  ms: number;
}

/**
 * Structured model call with transparent caching.
 *
 * Returns `cached` so callers can report real vs. replayed work — without it a
 * re-run looks suspiciously fast and you can't tell a cache hit from a no-op.
 */
export async function cachedObject<T>({
  model,
  prompt,
  schema,
  schemaName,
  system,
  maxRetries = 2,
}: CachedObjectArgs<T>): Promise<CachedObjectResult<T>> {
  const key = createHash("sha256")
    .update(JSON.stringify({ model, prompt, system, schemaName }))
    .digest("hex");

  const hit = readCache<T>(key);
  if (hit) return { object: hit, cached: true, ms: 0 };

  const started = Date.now();
  const result = await generateObject({
    model: openai(model),
    schema,
    prompt,
    system,
    maxRetries,
  });

  writeCache(key, result.object);
  return { object: result.object, cached: false, ms: Date.now() - started };
}

export interface FastObjectArgs<T> {
  model: string;
  prompt: string;
  schema: z.ZodType<T>;
  system?: string;
  signal?: AbortSignal;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Structured model call for the request path — deliberately NOT cached.
 *
 * cachedObject() writes to `.rag-cache/` on disk, which is right for ingest on a
 * developer machine and wrong for a serverless request: Vercel's filesystem is
 * read-only outside /tmp, and instances do not share state, so a disk cache
 * would be a per-instance memory leak that rarely hits. Query-time caching, if
 * it is ever worth adding, belongs in a shared store keyed by normalized query.
 *
 * `signal` is threaded through so an abandoned request stops paying for tokens
 * the moment the user navigates away or cancels the stream.
 */
export async function fastObject<T>({
  model,
  prompt,
  schema,
  system,
  signal,
  maxOutputTokens,
  temperature = 0.2,
}: FastObjectArgs<T>): Promise<T> {
  const { object } = await generateObject({
    model: openai(model),
    schema,
    prompt,
    system,
    abortSignal: signal,
    maxOutputTokens,
    temperature,
    maxRetries: 1, // a second retry costs more latency than the fallback path
  });
  return object;
}

/**
 * Runs `fn` over `items` with bounded concurrency, preserving input order.
 *
 * Ingest is hundreds of independent calls; unbounded Promise.all would trip
 * rate limits, and a serial loop would take an hour.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBEDDING_DIMS } from "./embed";

export const CHUNK_COLLECTION = "expo_chunks";
export const LESSON_COLLECTION = "expo_lessons";

let client: QdrantClient | null = null;

export function qdrant(): QdrantClient {
  if (client) return client;

  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    throw new Error("QDRANT_URL and QDRANT_API_KEY must be set");
  }

  client = new QdrantClient({ url, apiKey, checkCompatibility: false });
  return client;
}

/**
 * Qdrant point ids must be an unsigned integer or a UUID, but our ids are
 * readable strings ("m4-03-dynamic-routes#s03#c01"). Deriving a UUID
 * deterministically from the string means re-ingesting the same chunk upserts
 * the same point instead of creating a duplicate — so a re-run is idempotent
 * without needing to wipe the collection first.
 */
export function pointId(stringId: string): string {
  const h = createHash("sha256").update(stringId).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20, 32),
  ].join("-");
}

/**
 * Payload fields we filter or route on.
 *
 * `instructor` is who TAUGHT the clip, which is separate from which persona is
 * answering — it exists so an answer can attribute correctly rather than let a
 * persona imply they taught material they didn't.
 */
export interface ChunkPayload {
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
  tags: string[];
  /** Kept in the payload so a search can render results without a DB round
   *  trip; Postgres remains the source of truth. */
  text: string;
  context: string;
}

export interface LessonPayload {
  lessonId: string;
  moduleNum: number;
  moduleSlug: string;
  instructor: string;
  displayTitle: string;
  summary: string;
  topics: string[];
  durationMs: number;
}

/**
 * Creates both collections if absent, plus the payload indexes.
 *
 * Payload indexes are not optional at query time: filtering on an unindexed
 * field forces a full scan, which defeats the point of the HNSW index.
 */
export async function ensureCollections(recreate = false): Promise<void> {
  const c = qdrant();
  const existing = new Set(
    (await c.getCollections()).collections.map((x) => x.name),
  );

  for (const name of [CHUNK_COLLECTION, LESSON_COLLECTION]) {
    if (existing.has(name) && recreate) {
      await c.deleteCollection(name);
      existing.delete(name);
    }
    if (existing.has(name)) continue;

    await c.createCollection(name, {
      vectors: { size: EMBEDDING_DIMS, distance: "Cosine" },
    });
  }

  const indexes: Array<[string, "keyword" | "integer"]> = [
    ["lessonId", "keyword"],
    ["moduleNum", "integer"],
    ["moduleSlug", "keyword"],
    ["instructor", "keyword"],
    ["tags", "keyword"],
  ];

  for (const [field, schema] of indexes) {
    // Creating an index that already exists is an error, not a no-op, and there
    // is no "if not exists" — so tolerate the conflict rather than branch on a
    // separate lookup.
    await c
      .createPayloadIndex(CHUNK_COLLECTION, {
        field_name: field,
        field_schema: schema,
        wait: true,
      })
      .catch(() => {});
  }

  for (const [field, schema] of indexes.filter(([f]) => f !== "tags")) {
    await c
      .createPayloadIndex(LESSON_COLLECTION, {
        field_name: field,
        field_schema: schema,
        wait: true,
      })
      .catch(() => {});
  }
}

const UPSERT_BATCH = 200;

export async function upsertPoints(
  collection: string,
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  const c = qdrant();
  for (let i = 0; i < points.length; i += UPSERT_BATCH) {
    await c.upsert(collection, {
      wait: true,
      points: points.slice(i, i + UPSERT_BATCH),
    });
  }
}

export async function collectionCounts(): Promise<Record<string, number>> {
  const c = qdrant();
  const out: Record<string, number> = {};
  for (const name of [CHUNK_COLLECTION, LESSON_COLLECTION]) {
    try {
      out[name] = (await c.count(name, { exact: true })).count;
    } catch {
      out[name] = 0;
    }
  }
  return out;
}

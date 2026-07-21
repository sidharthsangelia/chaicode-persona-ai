import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { mapPool } from "./llm";

/**
 * text-embedding-3-small: $0.02/M, 1536 dims. The whole 22-hour course embeds
 * for about a cent, which is what makes re-indexing on a chunking change a
 * decision you can just make rather than budget for.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

/**
 * OpenAI accepts up to 2048 inputs per request, but the binding constraint here
 * is tokens, not count: 1,700 chunks at ~250 tokens is ~425k tokens, far past
 * what one request will take. Batching by count with a conservative size keeps
 * every request comfortably inside the limit.
 */
const BATCH_SIZE = 100;
const CONCURRENCY = 4;

export async function embedTexts(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  const model = openai.textEmbeddingModel(EMBEDDING_MODEL);

  const results = await mapPool(batches, CONCURRENCY, async (batch) => {
    const { embeddings } = await embedMany({ model, values: batch, maxRetries: 3 });
    done += batch.length;
    onProgress?.(done, texts.length);
    return embeddings;
  });

  return results.flat();
}

/** Embeds a single string — used at query time for the generated queries. */
export async function embedOne(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

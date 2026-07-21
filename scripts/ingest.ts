/**
 * Builds the course RAG index: subtitles -> segments -> chunks -> enrichment
 * -> Postgres + Qdrant.
 *
 *   npx tsx scripts/ingest.ts                  # only lessons whose .srt changed
 *   npx tsx scripts/ingest.ts --force          # re-ingest everything
 *   npx tsx scripts/ingest.ts --module 4       # one module
 *   npx tsx scripts/ingest.ts --limit 3        # first N lessons, for a smoke run
 *   npx tsx scripts/ingest.ts --recreate       # drop and rebuild Qdrant collections
 *
 * Model responses are cached on disk by lib/rag/llm.ts, so a re-run after a
 * code change replays for free and only genuinely new work hits the API.
 */
import "dotenv/config";
import { type LessonWithCues, loadCourse } from "../lib/rag/catalog";
import { windowCues } from "../lib/rag/chunk";
import { buildEmbedText, buildLessonEmbedText, enrichSegment, summarizeLesson } from "../lib/rag/enrich";
import { embedTexts } from "../lib/rag/embed";
import { mapPool } from "../lib/rag/llm";
import {
  CHUNK_COLLECTION,
  LESSON_COLLECTION,
  collectionCounts,
  ensureCollections,
  pointId,
  upsertPoints,
} from "../lib/rag/qdrant";
import { segmentLesson } from "../lib/rag/segment";
import { prisma } from "../lib/prisma";
import type { Chunk, Lesson, LessonSummary, Segment } from "../lib/rag/types";
import { isPlaceholderTitle } from "../lib/rag/types";

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const value = (flag: string) => {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
};

const FORCE = has("--force");
const RECREATE = has("--recreate");
const MODULE = value("--module");
const LIMIT = value("--limit");

interface Built {
  lesson: Lesson;
  segments: Segment[];
  chunks: Chunk[];
  summary: LessonSummary;
}

function log(stage: string, msg: string) {
  console.log(`[${stage.padEnd(9)}] ${msg}`);
}

/** Progress that overwrites one line rather than spamming the scrollback. */
function progress(label: string) {
  let done = 0;
  return {
    tick(total: number) {
      done++;
      process.stderr.write(`\r  ${label}: ${done}/${total}`);
      if (done === total) process.stderr.write("\n");
    },
  };
}

async function selectLessons(course: LessonWithCues[]): Promise<LessonWithCues[]> {
  let targets = course;

  if (MODULE) {
    targets = targets.filter((l) => String(l.lesson.moduleNum) === MODULE);
  }

  if (!FORCE) {
    // Content-hash skip: an unchanged .srt cannot produce different chunks, so
    // there is nothing to recompute. This is what makes routine re-runs cheap.
    const known = await prisma.courseLesson.findMany({
      select: { id: true, contentHash: true },
    });
    const hashes = new Map(known.map((k) => [k.id, k.contentHash]));
    const before = targets.length;
    targets = targets.filter((l) => hashes.get(l.lesson.id) !== l.lesson.contentHash);
    if (before !== targets.length) {
      log("select", `${before - targets.length} lesson(s) unchanged, skipping`);
    }
  }

  if (LIMIT) targets = targets.slice(0, Number(LIMIT));
  return targets;
}

async function build(targets: LessonWithCues[]): Promise<Built[]> {
  // Stages are run across ALL lessons rather than nested per lesson, so
  // concurrency stays flat and predictable instead of multiplying.
  const segP = progress("segmenting");
  const segmented = await mapPool(targets, 6, async ({ lesson, cues }) => {
    const segments = await segmentLesson(lesson, cues);
    segP.tick(targets.length);
    return { lesson, cues, segments };
  });

  const segmentJobs = segmented.flatMap(({ lesson, cues, segments }) =>
    segments.map((segment) => ({
      lesson,
      segment,
      windows: windowCues(cues.filter((c) => c.i >= segment.startCue && c.i <= segment.endCue)),
    })),
  );

  const enrP = progress("enriching");
  const enriched = await mapPool(segmentJobs, 8, async (job) => {
    const chunks = await enrichSegment(job.lesson, job.segment, job.windows);
    enrP.tick(segmentJobs.length);
    return { lessonId: job.lesson.id, chunks };
  });

  const chunksByLesson = new Map<string, Chunk[]>();
  for (const { lessonId, chunks } of enriched) {
    const list = chunksByLesson.get(lessonId) ?? [];
    list.push(...chunks);
    chunksByLesson.set(lessonId, list);
  }

  const sumP = progress("summarizing");
  return mapPool(segmented, 6, async ({ lesson, segments }) => {
    const summary = await summarizeLesson(lesson, segments);
    sumP.tick(segmented.length);
    return {
      lesson,
      segments,
      chunks: chunksByLesson.get(lesson.id) ?? [],
      summary,
    };
  });
}

async function writePostgres(built: Built[]): Promise<void> {
  for (const { lesson, segments, chunks, summary } of built) {
    // Placeholder folder names ("Chapter 2") get the transcript-derived title;
    // a real title from the course is left alone.
    const displayTitle = isPlaceholderTitle(lesson.title)
      ? summary.displayTitle
      : lesson.title;

    const data = {
      moduleSlug: lesson.moduleSlug,
      moduleNum: lesson.moduleNum,
      moduleLabel: lesson.moduleLabel,
      title: lesson.title,
      displayTitle,
      kind: lesson.kind,
      order: lesson.order,
      courseOrder: lesson.courseOrder,
      instructor: lesson.instructor,
      durationMs: lesson.durationMs,
      cueCount: lesson.cueCount,
      contentHash: lesson.contentHash,
      videoUrl: lesson.videoUrl,
      summary: summary.summary,
      topics: summary.topics,
      topicsText: summary.topics.join(" "),
      srtPath: lesson.srtPath,
    };

    await prisma.courseLesson.upsert({
      where: { id: lesson.id },
      create: { id: lesson.id, ...data },
      update: data,
    });

    // Replace children wholesale: segment/chunk ids shift when boundaries move,
    // so upserting individually would leave orphans from the previous run.
    await prisma.courseSegment.deleteMany({ where: { lessonId: lesson.id } });

    await prisma.courseSegment.createMany({
      data: segments.map((s) => ({
        id: s.id,
        lessonId: s.lessonId,
        ordinal: s.ordinal,
        title: s.title,
        startCue: s.startCue,
        endCue: s.endCue,
        startMs: s.startMs,
        endMs: s.endMs,
        text: s.text,
      })),
    });

    await prisma.courseChunk.createMany({
      data: chunks.map((c) => ({
        id: c.id,
        lessonId: c.lessonId,
        segmentId: c.segmentId,
        ordinal: c.ordinal,
        startCue: c.startCue,
        endCue: c.endCue,
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.text,
        context: c.context,
        tags: c.tags,
        tagsText: c.tags.join(" "),
      })),
    });
  }
}

async function writeQdrant(built: Built[]): Promise<void> {
  const allChunks = built.flatMap((b) =>
    b.chunks.map((chunk) => ({ chunk, lesson: b.lesson, summary: b.summary })),
  );

  const embP = progress("embedding");
  const chunkVectors = await embedTexts(
    allChunks.map(({ chunk, lesson }) => buildEmbedText(chunk, lesson)),
    (done, total) => {
      process.stderr.write(`\r  embedding chunks: ${done}/${total}`);
      if (done === total) process.stderr.write("\n");
    },
  );
  void embP;

  const segmentTitles = new Map(
    built.flatMap((b) => b.segments.map((s) => [s.id, s.title] as const)),
  );

  await upsertPoints(
    CHUNK_COLLECTION,
    allChunks.map(({ chunk, lesson }, i) => ({
      id: pointId(chunk.id),
      vector: chunkVectors[i],
      payload: {
        chunkId: chunk.id,
        lessonId: chunk.lessonId,
        segmentId: chunk.segmentId,
        moduleNum: lesson.moduleNum,
        moduleSlug: lesson.moduleSlug,
        instructor: lesson.instructor,
        lessonTitle: lesson.title,
        segmentTitle: segmentTitles.get(chunk.segmentId) ?? "",
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        tags: chunk.tags,
        text: chunk.text,
        context: chunk.context,
      },
    })),
  );

  const lessonVectors = await embedTexts(
    built.map((b) => buildLessonEmbedText(b.lesson, b.summary)),
  );

  await upsertPoints(
    LESSON_COLLECTION,
    built.map((b, i) => ({
      id: pointId(b.lesson.id),
      vector: lessonVectors[i],
      payload: {
        lessonId: b.lesson.id,
        moduleNum: b.lesson.moduleNum,
        moduleSlug: b.lesson.moduleSlug,
        instructor: b.lesson.instructor,
        displayTitle: isPlaceholderTitle(b.lesson.title)
          ? b.summary.displayTitle
          : b.lesson.title,
        summary: b.summary.summary,
        topics: b.summary.topics,
        durationMs: b.lesson.durationMs,
      },
    })),
  );
}

async function main() {
  const started = Date.now();

  await ensureCollections(RECREATE);
  if (RECREATE) log("qdrant", "collections recreated");

  const course = loadCourse();
  const targets = await selectLessons(course);
  log("select", `${targets.length} of ${course.length} lesson(s) to ingest`);
  if (targets.length === 0) {
    log("done", "nothing to do");
    return;
  }

  const built = await build(targets);

  log("postgres", "writing lessons, segments, chunks...");
  await writePostgres(built);

  log("qdrant", "embedding and upserting...");
  await writeQdrant(built);

  const counts = await collectionCounts();
  const chunkTotal = built.reduce((n, b) => n + b.chunks.length, 0);
  const segTotal = built.reduce((n, b) => n + b.segments.length, 0);

  log("done", `${built.length} lessons · ${segTotal} segments · ${chunkTotal} chunks in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  log("qdrant", Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

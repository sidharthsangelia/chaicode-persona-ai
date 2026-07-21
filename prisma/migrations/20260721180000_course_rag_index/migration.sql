-- CreateTable
CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "moduleNum" INTEGER NOT NULL,
    "moduleLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "displayTitle" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "courseOrder" INTEGER NOT NULL,
    "instructor" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "cueCount" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "videoUrl" TEXT,
    "summary" TEXT NOT NULL,
    "topics" TEXT[],
    "topicsText" TEXT NOT NULL DEFAULT '',
    "srtPath" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tsv" tsvector,

    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSegment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startCue" INTEGER NOT NULL,
    "endCue" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "CourseSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseChunk" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "startCue" INTEGER NOT NULL,
    "endCue" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "tags" TEXT[],
    "tagsText" TEXT NOT NULL DEFAULT '',
    "tsv" tsvector,

    CONSTRAINT "CourseChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLesson_moduleNum_courseOrder_idx" ON "CourseLesson"("moduleNum", "courseOrder");

-- CreateIndex
CREATE INDEX "CourseSegment_lessonId_ordinal_idx" ON "CourseSegment"("lessonId", "ordinal");

-- CreateIndex
CREATE INDEX "CourseChunk_lessonId_idx" ON "CourseChunk"("lessonId");

-- CreateIndex
CREATE INDEX "CourseChunk_segmentId_idx" ON "CourseChunk"("segmentId");

-- AddForeignKey
ALTER TABLE "CourseSegment" ADD CONSTRAINT "CourseSegment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChunk" ADD CONSTRAINT "CourseChunk_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChunk" ADD CONSTRAINT "CourseChunk_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CourseSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Keyword retrieval leg.
--
-- Generated columns are maintained by Postgres, so the search vector can never
-- drift from the row the way an app-side write or trigger can. Prisma cannot
-- express GENERATED ALWAYS — it emits "tsv" as an ordinary column above — so
-- each is dropped and re-added here as a generated column. The tables are
-- created empty by this same migration, so the drops discard nothing.
--
-- Only immutable expressions are allowed in a STORED column, which rules out
-- array_to_string() and the ::text array cast. That is why tags/topics are
-- denormalized into tagsText/topicsText at ingest and indexed from there.
--
-- Weighting puts the contextual header and tags above verbatim speech, because
-- the header carries the nouns that spoken language leaves out.
-- ---------------------------------------------------------------------------

ALTER TABLE "CourseChunk" DROP COLUMN "tsv";
ALTER TABLE "CourseChunk" ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("context", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("tagsText", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("text", '')), 'B')
  ) STORED;

CREATE INDEX "CourseChunk_tsv_idx" ON "CourseChunk" USING GIN ("tsv");

ALTER TABLE "CourseLesson" DROP COLUMN "tsv";
ALTER TABLE "CourseLesson" ADD COLUMN "tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("displayTitle", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("topicsText", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("summary", '')), 'B')
  ) STORED;

CREATE INDEX "CourseLesson_tsv_idx" ON "CourseLesson" USING GIN ("tsv");

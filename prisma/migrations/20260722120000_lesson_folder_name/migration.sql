-- Adds the on-disk lesson directory name, rendered under each citation so a
-- learner can locate the folder by eye. Prettified titles drop the number
-- prefix and the _epm suffix, so they do not match what a file browser lists.
--
-- Additive with a default: existing rows stay valid and re-ingest backfills them.
ALTER TABLE "CourseLesson" ADD COLUMN "folderName" TEXT NOT NULL DEFAULT '';

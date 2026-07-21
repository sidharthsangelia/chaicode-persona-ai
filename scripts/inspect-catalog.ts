/**
 * Verifies the deterministic half of ingestion: folder walking, name parsing,
 * and SRT parsing. No network, no model calls, no cost.
 *
 *   npx tsx scripts/inspect-catalog.ts          # summary + integrity checks
 *   npx tsx scripts/inspect-catalog.ts --full   # every lesson, one per line
 */
import { readFileSync } from "node:fs";
import { loadCourse } from "../lib/rag/catalog";
import { formatTimestamp } from "../lib/rag/types";

const full = process.argv.includes("--full");
const course = loadCourse();

let currentModule = "";
let totalCues = 0;
let totalDuration = 0;
let totalChars = 0;

for (const { lesson, cues } of course) {
  totalCues += cues.length;
  totalDuration += lesson.durationMs;
  totalChars += cues.reduce((n, c) => n + c.text.length, 0);

  if (full) {
    if (lesson.moduleSlug !== currentModule) {
      currentModule = lesson.moduleSlug;
      console.log(
        `\n── ${lesson.moduleLabel} [${lesson.moduleSlug}] · ${lesson.instructor}`,
      );
    }
    console.log(
      `  ${String(lesson.courseOrder).padStart(2)} ${lesson.id.padEnd(46)} ` +
        `${formatTimestamp(lesson.durationMs).padStart(7)} ` +
        `${String(lesson.cueCount).padStart(4)} cues  ${lesson.title}`,
    );
  }
}

// ---- integrity checks -------------------------------------------------------
const problems: string[] = [];

const ids = new Set<string>();
for (const { lesson } of course) {
  if (ids.has(lesson.id)) problems.push(`duplicate lesson id: ${lesson.id}`);
  ids.add(lesson.id);
  if (!lesson.title) problems.push(`empty title: ${lesson.id}`);
}

for (const { lesson, cues } of course) {
  // Timestamps must advance; a regression means we mis-parsed a timing line and
  // any citation from this lesson would be untrustworthy.
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].startMs < cues[i - 1].startMs) {
      problems.push(`${lesson.id}: cue ${i} starts before cue ${i - 1}`);
      break;
    }
  }
  for (const c of cues) {
    if (c.endMs < c.startMs) {
      problems.push(`${lesson.id}: cue ${c.i} ends before it starts`);
      break;
    }
    // A bare numeral surviving as an entire cue means the sequence-number
    // lookahead let a line through that it should have dropped.
    if (/^\d+$/.test(c.text)) {
      problems.push(`${lesson.id}: cue ${c.i} is a bare number ("${c.text}")`);
      break;
    }
  }

  // Every sequence number in the file should have produced exactly one cue.
  const raw = readFileSync(lesson.srtPath, "utf8");
  const arrows = (raw.match(/-->/g) ?? []).length;
  if (arrows !== cues.length) {
    problems.push(
      `${lesson.id}: ${arrows} timing lines but ${cues.length} cues parsed`,
    );
  }
}

console.log(
  `\n${course.length} lessons · ${totalCues.toLocaleString()} cues · ` +
    `${(totalDuration / 3_600_000).toFixed(1)}h · ` +
    `${(totalChars / 1000).toFixed(0)}k chars of speech ` +
    `(~${Math.round(totalChars / 4 / 1000)}k tokens)`,
);

const byInstructor = new Map<string, number>();
for (const { lesson } of course) {
  byInstructor.set(
    lesson.instructor,
    (byInstructor.get(lesson.instructor) ?? 0) + 1,
  );
}
console.log(
  `instructors: ${[...byInstructor].map(([k, v]) => `${k}=${v}`).join(", ")}`,
);

if (problems.length) {
  console.log(`\n❌ ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 25)) console.log(`   ${p}`);
  process.exit(1);
}
console.log("✅ all integrity checks passed");

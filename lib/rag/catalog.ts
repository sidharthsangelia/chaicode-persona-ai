import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { durationOf, parseSubtitles } from "./parse-srt";
import type { Cue, Lesson, LessonKind } from "./types";

export const SUBTITLE_ROOT = "class-subtitle";

// Who taught what. Keyed by module folder name so it stays readable.
//
// TODO(sidharth): confirm which module is Piyush's — every folder is suffixed
// `_epm` except `module 1 hc`, so instructor isn't derivable from the tree.
// Adding Suraj's persona later is a change to this map plus a re-tag, NOT a
// re-embed: instructor lives in the Qdrant payload as a filterable field.
const MODULE_INSTRUCTOR: Record<string, string> = {
  "module 1 hc": "hitesh",
};
const DEFAULT_INSTRUCTOR = "suraj";

/** Folder-name suffix on every lesson directory; carries no information. */
const LESSON_SUFFIX_RE = /_epm$/i;

const MINI_PROJECT_RE = /^mini[-_\s]?project[-_\s]*(\d+)[-_.\s]*/i;
const CHAPTER_RE = /^chapter[-_\s]*(\d+)[-_.\s]*/i;
const LEADING_NUM_RE = /^(\d+)[-_.\s]+/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Turns a folder name into a readable title.
 *
 * Hyphens are only treated as word separators when they sit between two
 * non-space characters, so slug-style names ("not-found-route") expand while
 * genuine dashes in prose titles ("Expo Maps - Overview") survive.
 */
function prettifyTitle(raw: string): string {
  const cleaned = raw
    .replace(/_/g, " ")
    .replace(/(?<=\S)-(?=\S)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

interface ParsedLessonName {
  kind: LessonKind;
  order: number;
  title: string;
}

function parseLessonFolderName(folder: string): ParsedLessonName {
  const base = folder.replace(LESSON_SUFFIX_RE, "");

  const mini = MINI_PROJECT_RE.exec(base);
  if (mini) {
    const order = Number(mini[1]);
    return {
      kind: "mini-project",
      order,
      title:
        prettifyTitle(base.slice(mini[0].length)) || `Mini Project ${order}`,
    };
  }

  const chapter = CHAPTER_RE.exec(base);
  if (chapter) {
    const order = Number(chapter[1]);
    return {
      kind: "chapter",
      order,
      // Several folders are bare ("chapter-3_epm") with the topic only
      // discoverable from the transcript — the lesson summary backfills these.
      title: prettifyTitle(base.slice(chapter[0].length)) || `Chapter ${order}`,
    };
  }

  const num = LEADING_NUM_RE.exec(base);
  if (num) {
    const order = Number(num[1]);
    return {
      kind: "chapter",
      order,
      title: prettifyTitle(base.slice(num[0].length)) || `Chapter ${order}`,
    };
  }

  return { kind: "unnumbered", order: 0, title: prettifyTitle(base) };
}

interface ParsedModuleName {
  num: number;
  /** Trailing marker like "hc" that distinguishes two folders sharing a number. */
  suffix: string;
}

function parseModuleFolderName(folder: string): ParsedModuleName | null {
  const m = /^module\s+(\d+)\s*(.*)$/i.exec(folder.trim());
  if (!m) return null;
  return { num: Number(m[1]), suffix: m[2].trim() };
}

function listDirs(path: string): string[] {
  return readdirSync(path)
    .filter((name) => !name.startsWith(".")) // .DS_Store and friends
    .filter((name) => statSync(join(path, name)).isDirectory())
    .sort();
}

/** Chapters come before mini-projects; unnumbered extras go last. */
const KIND_RANK: Record<LessonKind, number> = {
  chapter: 0,
  "mini-project": 1,
  unnumbered: 2,
};

export interface LessonWithCues {
  lesson: Lesson;
  cues: Cue[];
}

/**
 * Walks the subtitle tree and returns every lesson in course order, with its
 * parsed cues. Pure filesystem + parsing — no network, no model calls, so it's
 * safe and instant to run repeatedly while tuning.
 */
export function loadCourse(root = SUBTITLE_ROOT): LessonWithCues[] {
  const collected: Array<{
    lesson: Omit<Lesson, "courseOrder">;
    cues: Cue[];
    sortKey: [number, string, number, number, string];
  }> = [];

  for (const moduleFolder of listDirs(root)) {
    const parsedModule = parseModuleFolderName(moduleFolder);
    if (!parsedModule) continue;

    const { num, suffix } = parsedModule;
    const moduleSlug = `m${num}${suffix ? slugify(suffix) : ""}`;
    const moduleLabel = `Module ${num}`;
    const instructor = MODULE_INSTRUCTOR[moduleFolder] ?? DEFAULT_INSTRUCTOR;
    const modulePath = join(root, moduleFolder);

    for (const lessonFolder of listDirs(modulePath)) {
      const lessonPath = join(modulePath, lessonFolder);

      const srtName = readdirSync(lessonPath).find(
        (f) => f.toLowerCase().endsWith(".srt") && !f.startsWith("."),
      );
      if (!srtName) continue;

      const srtPath = join(lessonPath, srtName);
      const raw = readFileSync(srtPath, "utf8");
      const cues = parseSubtitles(raw);
      if (cues.length === 0) continue;

      const { kind, order, title } = parseLessonFolderName(lessonFolder);
      const id = `${moduleSlug}-${kind === "mini-project" ? "mp" : ""}${String(
        order,
      ).padStart(2, "0")}-${slugify(title || basename(lessonFolder))}`;

      collected.push({
        lesson: {
          id,
          moduleSlug,
          moduleNum: num,
          moduleLabel,
          title,
          kind,
          order,
          instructor,
          srtPath,
          durationMs: durationOf(cues),
          cueCount: cues.length,
          contentHash: createHash("sha256").update(raw).digest("hex"),
          videoUrl: null,
        },
        cues,
        sortKey: [num, suffix, KIND_RANK[kind], order, title],
      });
    }
  }

  collected.sort((a, b) => {
    for (let i = 0; i < a.sortKey.length; i++) {
      const x = a.sortKey[i];
      const y = b.sortKey[i];
      if (x === y) continue;
      return typeof x === "number"
        ? x - (y as number)
        : String(x).localeCompare(String(y));
    }
    return 0;
  });

  return collected.map((entry, index) => ({
    lesson: { ...entry.lesson, courseOrder: index },
    cues: entry.cues,
  }));
}

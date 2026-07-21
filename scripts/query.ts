/**
 * Retrieval inspector. This is the tuning loop — no UI, no streaming, no auth,
 * just "what does the index actually return for this question".
 *
 *   npx tsx scripts/query.ts "how do I read a route param"
 *   npx tsx scripts/query.ts "expo-secure-store" --legs   # compare each leg
 *   npx tsx scripts/query.ts "how do I save data" --k 5 --module 6
 *   npx tsx scripts/query.ts "where do I learn navigation" --lessons
 *   npx tsx scripts/query.ts "dynamic routes" --context   # show parent segment
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { embedTexts } from "../lib/rag/embed";
import {
  DENSE_WEIGHT,
  denseSearch,
  expandToSegments,
  hybridSearch,
  KEYWORD_WEIGHT,
  keywordSearch,
  lessonSearch,
  rrfFuse,
} from "../lib/rag/retrieve";
import { formatTimestamp } from "../lib/rag/types";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const value = (flag: string) => {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
};
const query = argv
  .filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"))
  .join(" ");

const K = Number(value("--k") ?? 6);
const PER_LEG = Number(value("--per-leg") ?? 20);
const MODULE = value("--module") ? Number(value("--module")) : undefined;

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

async function main() {
  if (!query) {
    console.log(
      'usage: npx tsx scripts/query.ts "your question" [--k 6] [--legs] [--lessons] [--context] [--module N]',
    );
    return;
  }

  console.log(`\n${bold("query")}  ${query}`);
  if (MODULE !== undefined) console.log(dim(`filter  module ${MODULE}`));

  if (flags.has("--lessons")) {
    const t = Date.now();
    const lessons = await lessonSearch(query, K);
    console.log(dim(`\nlesson-level search · ${Date.now() - t}ms\n`));
    for (const [i, l] of lessons.entries()) {
      console.log(
        `${String(i + 1).padStart(2)}. ${l.score.toFixed(3)}  ${bold(l.displayTitle)}  ${dim(`Module ${l.moduleNum} · ${formatTimestamp(l.durationMs)}`)}`,
      );
      console.log(`    ${truncate(l.summary, 150)}`);
      console.log(dim(`    ${l.topics.slice(0, 6).join(" · ")}\n`));
    }
    return;
  }

  // --legs runs the two retrieval paths separately so you can see WHERE each
  // result came from, and what fusion changed. This is the view that makes RRF
  // legible rather than magic.
  if (flags.has("--legs")) {
    const t = Date.now();
    const [vector] = await embedTexts([query]);
    const [dense, keyword] = await Promise.all([
      denseSearch(
        vector,
        PER_LEG,
        MODULE !== undefined ? { moduleNum: MODULE } : undefined,
      ),
      keywordSearch(
        query,
        PER_LEG,
        MODULE !== undefined ? { moduleNum: MODULE } : undefined,
      ),
    ]);
    const fused = rrfFuse([dense, keyword], {
      weights: [DENSE_WEIGHT, KEYWORD_WEIGHT],
    }).slice(0, K);
    console.log(
      dim(
        `\nboth legs · ${Date.now() - t}ms · dense=${dense.length} keyword=${keyword.length}\n`,
      ),
    );

    const show = (
      label: string,
      list: typeof dense,
      scoreOf: (c: (typeof dense)[0]) => string,
    ) => {
      console.log(bold(label));
      if (list.length === 0) console.log(dim("    (no results)"));
      for (const [i, c] of list.slice(0, K).entries()) {
        console.log(
          `  ${String(i + 1).padStart(2)}. ${scoreOf(c)}  M${c.moduleNum} ${truncate(c.lessonTitle, 34).padEnd(34)} ${formatTimestamp(c.startMs)}  ${dim(truncate(c.segmentTitle, 40))}`,
        );
      }
      console.log();
    };

    show("DENSE ONLY (semantic)", dense, (c) => (c.denseScore ?? 0).toFixed(3));
    show("KEYWORD ONLY (tsvector)", keyword, (c) =>
      (c.keywordScore ?? 0).toFixed(4),
    );

    console.log(bold("FUSED (RRF)"));
    for (const [i, c] of fused.entries()) {
      const legs = [
        c.denseRank !== undefined ? `D#${c.denseRank + 1}` : "D–",
        c.keywordRank !== undefined ? `K#${c.keywordRank + 1}` : "K–",
      ].join(" ");
      const both = c.denseRank !== undefined && c.keywordRank !== undefined;
      console.log(
        `  ${String(i + 1).padStart(2)}. ${c.rrf.toFixed(4)} ${dim(legs)}${both ? " ✓both" : "      "}  M${c.moduleNum} ${truncate(c.lessonTitle, 32).padEnd(32)} ${formatTimestamp(c.startMs)}`,
      );
    }
    console.log();
    return;
  }

  const t = Date.now();
  const results = await hybridSearch([query], {
    perLeg: PER_LEG,
    limit: K,
    filter: MODULE !== undefined ? { moduleNum: MODULE } : undefined,
  });
  console.log(dim(`\nhybrid · ${Date.now() - t}ms\n`));

  for (const [i, c] of results.entries()) {
    const legs = [
      c.denseRank !== undefined ? `D#${c.denseRank + 1}` : "D–",
      c.keywordRank !== undefined ? `K#${c.keywordRank + 1}` : "K–",
    ].join(" ");
    console.log(
      `${String(i + 1).padStart(2)}. ${bold(`Module ${c.moduleNum}`)} · ${c.lessonTitle}  ${bold(formatTimestamp(c.startMs))}-${formatTimestamp(c.endMs)}  ${dim(`rrf=${c.rrf.toFixed(4)} ${legs}`)}`,
    );
    console.log(`    ${dim("topic  ")} ${c.segmentTitle}`);
    console.log(`    ${dim("context")} ${truncate(c.context, 150)}`);
    console.log(`    ${dim("said   ")} ${truncate(c.text, 150)}`);
    if (c.tags.length)
      console.log(
        `    ${dim("tags   ")} ${dim(c.tags.slice(0, 8).join(" · "))}`,
      );
    console.log();
  }

  if (flags.has("--context")) {
    const segments = await expandToSegments(results.slice(0, 2));
    console.log(
      bold("\n── parent segments the answering model would read ──\n"),
    );
    for (const s of segments) {
      console.log(
        `${bold(s.title)}  ${formatTimestamp(s.startMs)}-${formatTimestamp(s.endMs)}  ${dim(`${Math.round(s.text.length / 4)} tokens`)}`,
      );
      console.log(`${truncate(s.text, 600)}\n`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

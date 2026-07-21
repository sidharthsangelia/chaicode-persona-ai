import type { Cue } from "./types";

// Matches both SRT (00:00:05,520) and VTT (00:00:05.520) time formats, so the
// same parser reads either. We index the .srt files, but the .vtt copies are
// byte-identical in content and this keeps us from caring which one shows up.
const TIME_RE =
  /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;

function toMs(h: string, m: string, s: string, ms: string): number {
  return (
    Number(h) * 3_600_000 + Number(m) * 60_000 + Number(s) * 1000 + Number(ms)
  );
}

/**
 * Parses SRT/VTT into cues.
 *
 * Deliberately lenient: cue blocks are found by locating timing lines rather
 * than by assuming a fixed 3-line block shape, so a missing sequence number or
 * a cue whose text wraps across lines both parse fine. Anything that isn't a
 * timing line, a sequence number, or blank is text belonging to the cue above.
 *
 * The returned `i` is a fresh 0-based index, NOT the file's sequence number —
 * downstream stages address cues by position, so gaps in the source numbering
 * can't desync anything.
 */
export function parseSubtitles(raw: string): Cue[] {
  const lines = raw
    .replace(/^﻿/, "") // strip BOM
    .replace(/\r\n?/g, "\n") // CRLF / CR -> LF
    .split("\n");

  /** True if the next non-empty line after `from` is a timing line. */
  const timingFollows = (from: number): boolean => {
    for (let j = from + 1; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      return TIME_RE.test(lines[j]);
    }
    return false;
  };

  const cues: Cue[] = [];
  let pending: { startMs: number; endMs: number; text: string[] } | null = null;

  const flush = () => {
    if (!pending) return;
    const text = pending.text.join(" ").replace(/\s+/g, " ").trim();
    // Drop empty cues — they carry a timestamp but nothing to retrieve on.
    if (text) {
      cues.push({
        i: cues.length,
        startMs: pending.startMs,
        endMs: pending.endMs,
        text,
      });
    }
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const match = TIME_RE.exec(line);
    if (match) {
      flush();
      pending = {
        startMs: toMs(match[1], match[2], match[3], match[4]),
        endMs: toMs(match[5], match[6], match[7], match[8]),
        text: [],
      };
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    // A bare integer immediately preceding a timing line is that cue's sequence
    // number. Checking what follows — rather than assuming block shape — is what
    // keeps a numeral that happens to be spoken text ("2") from being eaten.
    if (/^\d+$/.test(trimmed) && timingFollows(i)) continue;

    if (!pending) continue; // WEBVTT header, NOTE blocks, other preamble

    pending.text.push(trimmed);
  }

  flush();
  return cues;
}

/** Total lesson length: the end of the last cue. */
export function durationOf(cues: Cue[]): number {
  return cues.length === 0 ? 0 : cues[cues.length - 1].endMs;
}

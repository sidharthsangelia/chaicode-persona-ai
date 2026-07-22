import type { PipelineEvent } from "./pipeline";

/**
 * Human-readable progress for the retrieval pipeline.
 *
 * Course questions spend around five seconds routing, searching and grading
 * before the first token, which is long enough that silence reads as a hang.
 * The pipeline already emits an event per stage; this turns those into something
 * worth showing a person.
 *
 * The import above is type-only, so this module carries no server dependencies
 * and the same shapes can be used on the client.
 */
export interface RagStatus {
  stage: "routing" | "planning" | "searching" | "retrying" | "writing";
  /** Ready to render. The server owns the wording so the UI stays dumb. */
  label: string;
}

/** The first status, before routing has decided anything. */
export const INITIAL_STATUS: RagStatus = {
  stage: "routing",
  label: "Reading your question…",
};

function moduleList(modules: number[]): string {
  if (modules.length === 0) return "the course";
  if (modules.length === 1) return `module ${modules[0]}`;
  return `modules ${modules.join(", ")}`;
}

/**
 * Maps a pipeline event to a status line, or null when there is nothing worth
 * saying.
 *
 * GENERAL and REFUSE deliberately return null on `routed`: they answer
 * immediately, and flashing "searching…" for a greeting would describe work that
 * is not happening.
 */
export function describeStage(event: PipelineEvent): RagStatus | null {
  switch (event.type) {
    case "routed":
      if (event.route.route === "COURSE") {
        return { stage: "planning", label: "Working out what to search for…" };
      }
      if (event.route.route === "CATALOG") {
        return { stage: "planning", label: "Checking the course outline…" };
      }
      return null;

    case "transformed":
      return { stage: "searching", label: "Searching the transcripts…" };

    case "retrieved":
      return {
        stage: "searching",
        label: `Found ${event.count} clips in ${moduleList(event.modules)}…`,
      };

    case "retrying":
      return { stage: "retrying", label: "Not quite right, looking again…" };

    case "graded":
      return event.sufficient
        ? { stage: "writing", label: "Putting it together…" }
        : null;
  }
}

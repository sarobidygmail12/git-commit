import type { CommandContext } from "../../contracts/command.js";
import { t } from "../../lang/index.js";
import {
  abortSequence,
  continueSequence,
  isSequenceRunning,
  listConflicts,
  skipSequenceStep,
  type SequenceOperation,
} from "../../server/services/sync.js";

export type SequenceOutcome = "completed" | "aborted" | "paused";

type ConflictAction = "continue" | "abort" | "skip";

function conflictChoices(): ReadonlyArray<{ label: string; value: ConflictAction }> {
  return [
    { label: t("sequence.continue"), value: "continue" },
    { label: t("sequence.abort"), value: "abort" },
    { label: t("sequence.skip"), value: "skip" },
  ];
}

/** Accompagne un cherry-pick ou un rebase commit après commit, jusqu'à ce qu'il soit fini ou abandonné. */
export async function resolveSequence(ctx: CommandContext, operation: SequenceOperation): Promise<SequenceOutcome> {
  if (!(await isSequenceRunning(ctx.git, operation))) return "completed";

  const conflicts = await listConflicts(ctx.git);
  const details = conflicts.length > 0 ? formatPaths(conflicts) : t("sequence.noConflictFiles");
  ctx.ui.log(t("sequence.interrupted", { operation, files: details }), "warn");

  const action = await ctx.ui.select(t("sequence.whatToDo"), conflictChoices());
  if (!action) {
    ctx.ui.log(t("sequence.stillRunning", { operation }), "warn");
    return "paused";
  }
  if (action === "abort") {
    await abortSequence(ctx.git, operation);
    ctx.ui.log(t("sequence.aborted", { operation }), "success");
    return "aborted";
  }
  if (action === "continue") await continueWithReport(ctx, operation, conflicts);
  else await skipSequenceStep(ctx.git, operation);
  return resolveSequence(ctx, operation);
}

async function continueWithReport(ctx: CommandContext, operation: SequenceOperation, conflicts: readonly string[]): Promise<void> {
  const outcome = await continueSequence(ctx.git, operation, conflicts);
  if (outcome.kind === "unresolved") {
    ctx.ui.log(t("sequence.stillConflicts", { files: formatPaths(outcome.paths) }), "error");
    return;
  }
  if (outcome.warning !== undefined) ctx.ui.log(outcome.warning, "warn");
}

function formatPaths(paths: readonly string[]): string {
  return paths.map((path) => `  ${path}`).join("\n");
}

import { GitError } from "../core/errors.js";
import { isCommitHash } from "../core/git/log.js";
import { assertNoOperationInProgress } from "../core/git/status.js";
import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { startCherryPick } from "../server/services/sync.js";
import { resolveSequence } from "./shared/resolveSequence.js";
import { warnUsage } from "./shared/usage.js";

export const cherryPickCommand: Command = {
  name: "cherry-pick",
  aliases: ["cp"],
  get description() {
    return t("cmd.cherryPick");
  },
  usage: "/cherry-pick <hash...>",
  examples: ["/cherry-pick a1b2c3d", "/cherry-pick a1b2c3d e4f5a6b"],
  get gitSteps() {
    return ["git cherry-pick <hash...>", t("step.conflictCherryPick")];
  },
  run: async (ctx, hashes) => {
    if (hashes.length === 0) return warnUsage(ctx, cherryPickCommand);
    const invalid = hashes.filter((hash) => !isCommitHash(hash));
    if (invalid.length > 0) throw new GitError(t("cherryPick.invalidHash", { hashes: invalid.join(", ") }));
    await assertNoOperationInProgress(ctx.git);

    await startCherryPick(ctx.git, hashes);
    if ((await resolveSequence(ctx, "cherry-pick")) === "completed") ctx.ui.log(t("cherryPick.done"), "success");
  },
};

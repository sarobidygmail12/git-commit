import { DEFAULT_REMOTE } from "../constants/git.js";
import { GitError } from "../core/errors.js";
import { pushCurrentBranch } from "../core/git/branches.js";
import { assertNoOperationInProgress, getStatus } from "../core/git/status.js";
import { resolveSequence } from "./shared/resolveSequence.js";
import { secureWorkingTree } from "./shared/secureWorkingTree.js";
import type { Command, CommandContext } from "../contracts/command.js";
import { t } from "../lang/index.js";
import {
  assertHasDefaultRemote,
  countMissingRemoteCommits,
  fetchFromDefaultRemote,
  isSequenceRunning,
  startRebase,
} from "../server/services/sync.js";

export const firstPushCommand: Command = {
  name: "first-push",
  aliases: ["fp"],
  get description() {
    return t("cmd.firstPush");
  },
  usage: "/first-push",
  examples: ["/first-push"],
  get gitSteps() {
    return [
    "git fetch origin",
    t("step.firstPushDirty"),
    "git rebase origin/<branch>",
    t("step.conflictRebase"),
    "git push -u origin <branch>",
  ];
  },
  run: async (ctx) => {
    if (await isSequenceRunning(ctx.git, "rebase")) return finishRebaseThenPublish(ctx);
    await assertNoOperationInProgress(ctx.git);
    await assertHasDefaultRemote(ctx.git);

    const status = await getStatus(ctx.git);
    if (!status.branch) throw new GitError(t("head.switchFirst"));
    if (!status.headHash) throw new GitError(t("firstPush.noCommit"));
    if (status.upstream) {
      ctx.ui.log(t("firstPush.alreadyLinked", { branch: status.branch, upstream: status.upstream }), "warn");
      return;
    }

    await ctx.ui.spinner(t("spinner.fetchRemote", { remote: DEFAULT_REMOTE }), () => fetchFromDefaultRemote(ctx.git));
    const missingCommits = await countMissingRemoteCommits(ctx.git, status.branch);
    if (missingCommits === 0) return publish(ctx);

    ctx.ui.log(t("firstPush.missingCommits", { remote: `${DEFAULT_REMOTE}/${status.branch}`, count: missingCommits }));
    if (!(await secureWorkingTree(withoutAutoPush(ctx), "/first-push"))) {
      ctx.ui.log(t("firstPush.cancelled"), "warn");
      return;
    }
    await startRebase(ctx.git, `${DEFAULT_REMOTE}/${status.branch}`);
    await finishRebaseThenPublish(ctx);
  },
};

/** Tant que le remote n'est pas intégré, le push automatique de /commit serait rejeté. */
function withoutAutoPush(ctx: CommandContext): CommandContext {
  return { ...ctx, config: { ...ctx.config, commit: { ...ctx.config.commit, autoPush: false } } };
}

async function finishRebaseThenPublish(ctx: CommandContext): Promise<void> {
  const outcome = await resolveSequence(ctx, "rebase");
  if (outcome === "completed") return publish(ctx);
  ctx.ui.log(t(outcome === "paused" ? "firstPush.pausedNothing" : "firstPush.nothing"), "warn");
}

async function publish(ctx: CommandContext): Promise<void> {
  const status = await getStatus(ctx.git);
  await ctx.ui.spinner(t("spinner.push"), () => pushCurrentBranch(ctx.git, status));
  ctx.ui.log(t("firstPush.published", { branch: status.branch ?? t("firstPush.theBranch") }), "success");
}

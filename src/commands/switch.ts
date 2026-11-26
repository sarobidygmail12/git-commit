import { listSwitchableBranches } from "../core/git/branches.js";
import { assertNoOperationInProgress } from "../core/git/status.js";
import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { assertValidBranchName, switchToBranch } from "../server/services/branch.js";
import { secureWorkingTree } from "./shared/secureWorkingTree.js";
import { warnUsage } from "./shared/usage.js";

export const switchCommand: Command = {
  name: "switch",
  aliases: ["sw"],
  get description() {
    return t("cmd.switch");
  },
  usage: "/switch <branch>",
  examples: ["/switch develop"],
  get gitSteps() {
    return ["git status", t("step.commitOrStashIfDirty"), "git switch <branch>"];
  },
  completeArgs: (ctx) => listSwitchableBranches(ctx.git),
  run: async (ctx, [branch]) => {
    if (branch === undefined) return warnUsage(ctx, switchCommand);
    await assertValidBranchName(ctx.git, branch);
    await assertNoOperationInProgress(ctx.git);
    if (!(await secureWorkingTree(ctx, `/switch ${branch}`))) {
      ctx.ui.log(t("switch.cancelled"), "warn");
      return;
    }
    await switchToBranch(ctx.git, branch);
    ctx.ui.log(t("switch.on", { branch }), "success");
  },
};

import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { createBranch } from "../server/services/branch.js";
import { warnUsage } from "./shared/usage.js";

export const branchCommand: Command = {
  name: "branch",
  get description() {
    return t("cmd.branch");
  },
  usage: "/branch <name>",
  examples: ["/branch feature/cart"],
  gitSteps: ["git switch -c <name>"],
  run: async (ctx, [name]) => {
    if (name === undefined) return warnUsage(ctx, branchCommand);
    const { hadChanges } = await createBranch(ctx.git, name);
    ctx.ui.log(t(hadChanges ? "branch.createdWithChanges" : "branch.created", { name }), "success");
  },
};

import { assertNoOperationInProgress } from "../core/git/status.js";
import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { pullFastForward } from "../server/services/sync.js";

export const pullCommand: Command = {
  name: "pull",
  get description() {
    return t("cmd.pull");
  },
  usage: "/pull",
  examples: ["/pull"],
  gitSteps: ["git pull --ff-only"],
  run: async (ctx) => {
    await assertNoOperationInProgress(ctx.git);
    const output = await ctx.ui.spinner(t("spinner.pull"), () => pullFastForward(ctx.git));
    ctx.ui.log(output, "success");
  },
};

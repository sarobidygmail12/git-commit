import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { undoLastCommit } from "../server/services/commit.js";

export const undoCommand: Command = {
  name: "undo",
  get description() {
    return t("cmd.undo");
  },
  usage: "/undo",
  examples: ["/undo"],
  gitSteps: ["git branch -r --contains HEAD", "git reset --soft HEAD~1"],
  run: async (ctx) => {
    await undoLastCommit(ctx.git);
    ctx.ui.log(t("undo.done"), "success");
  },
};

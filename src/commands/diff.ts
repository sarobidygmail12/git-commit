import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { readDiffSummary } from "../server/services/repo.js";

export const diffCommand: Command = {
  name: "diff",
  get description() {
    return t("cmd.diff");
  },
  usage: "/diff",
  examples: ["/diff"],
  gitSteps: ["git diff --cached --stat", "git diff --stat"],
  run: async (ctx) => {
    const summary = await readDiffSummary(ctx.git);
    const sections = [
      summary.staged && t("diff.staged", { diff: summary.staged }),
      summary.unstaged && t("diff.unstaged", { diff: summary.unstaged }),
      summary.untracked.length > 0 && t("diff.untracked", { files: summary.untracked.map((path) => `  ${path}`).join("\n") }),
    ].filter((section) => typeof section === "string" && section !== "");
    ctx.ui.log(sections.length > 0 ? sections.join("\n\n") : t("diff.none"));
  },
};

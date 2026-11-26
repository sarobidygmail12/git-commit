import { getStatus, isStaged, isUnstaged } from "../core/git/status.js";
import type { Command, CommandContext } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { amendHead, assertCanRewriteHead, readHeadMessageParts, stageAll } from "../server/services/commit.js";
import { confirmSensitiveFiles } from "./shared/commitFlow.js";

export const amendCommand: Command = {
  name: "amend",
  get description() {
    return t("cmd.amend");
  },
  usage: '/amend ["new message"]',
  examples: ["/amend", '/amend "fix: correct the VAT calculation"'],
  get gitSteps() {
    return ["git branch -r --contains HEAD", t("step.amendAdd"), "git commit --amend"];
  },
  run: async (ctx, args) => {
    await assertCanRewriteHead(ctx.git);
    const current = await readHeadMessageParts(ctx.git);
    const typed = args.join(" ").trim();
    const subject = typed !== "" ? typed : (await ctx.ui.ask(t("amend.prompt"), { initial: current.subject }))?.trim();
    if (!subject || !(await includeWorkingChanges(ctx))) {
      ctx.ui.log(t("amend.cancelled"), "warn");
      return;
    }

    const { files } = await getStatus(ctx.git);
    if (subject === current.subject && !files.some(isStaged)) {
      ctx.ui.log(t("amend.nothing"));
      return;
    }
    await amendHead(ctx.git, current, subject);
    ctx.ui.log(t("amend.done"), "success");
  },
};

/** Renvoie false seulement si l'utilisateur refuse d'inclure des fichiers sensibles. */
async function includeWorkingChanges(ctx: CommandContext): Promise<boolean> {
  if (!ctx.config.commit.addAll) return true;
  const { files } = await getStatus(ctx.git);
  const unstaged = files.filter(isUnstaged);
  if (unstaged.length === 0) return true;
  if (!(await ctx.ui.confirm(t("amend.includeUnstaged", { count: unstaged.length })))) return true;
  if (!(await confirmSensitiveFiles(ctx, unstaged))) return false;
  await stageAll(ctx.git);
  return true;
}

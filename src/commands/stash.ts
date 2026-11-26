import { getStatus } from "../core/git/status.js";
import type { Command, CommandContext } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { listStashes, popStash, stashAll } from "../server/services/repo.js";
import { warnUsage } from "./shared/usage.js";

const SUBCOMMANDS = ["pop", "list"];

export const stashCommand: Command = {
  name: "stash",
  get description() {
    return t("cmd.stash");
  },
  usage: "/stash [pop|list]",
  examples: ["/stash", "/stash pop", "/stash list"],
  gitSteps: ["git stash push -u", "git stash pop", "git stash list"],
  completeArgs: () => Promise.resolve(SUBCOMMANDS),
  run: async (ctx, [subcommand]) => {
    if (subcommand === undefined) return pushStash(ctx);
    if (subcommand === "pop") return ctx.ui.log(await popStash(ctx.git), "success");
    if (subcommand === "list") return showStashes(ctx);
    warnUsage(ctx, stashCommand);
  },
};

async function pushStash(ctx: CommandContext): Promise<void> {
  const { files } = await getStatus(ctx.git);
  if (files.length === 0) {
    ctx.ui.log(t("stash.nothing"));
    return;
  }
  await stashAll(ctx.git);
  ctx.ui.log(t("stash.done"), "success");
}

async function showStashes(ctx: CommandContext): Promise<void> {
  const stashes = await listStashes(ctx.git);
  ctx.ui.log(stashes === "" ? t("stash.none") : stashes);
}

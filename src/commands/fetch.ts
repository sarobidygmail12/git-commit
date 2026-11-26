import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { fetchAllRemotes } from "../server/services/sync.js";

export const fetchCommand: Command = {
  name: "fetch",
  get description() {
    return t("cmd.fetch");
  },
  usage: "/fetch",
  examples: ["/fetch"],
  gitSteps: ["git fetch --all"],
  run: async (ctx) => {
    await ctx.ui.spinner(t("spinner.fetch"), () => fetchAllRemotes(ctx.git));
    ctx.ui.log(t("fetch.done"), "success");
  },
};

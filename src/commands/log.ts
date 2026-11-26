import { PAGE_ROUTES } from "../constants/routes.js";
import { openPage } from "./shared/openBrowser.js";
import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";

export const logCommand: Command = {
  name: "log",
  get description() {
    return t("cmd.log");
  },
  usage: "/log",
  examples: ["/log"],
  gitSteps: ["git log --all --date-order"],
  run: (ctx) => openPage(ctx, PAGE_ROUTES.log),
};

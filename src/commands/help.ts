import { PAGE_ROUTES } from "../constants/routes.js";
import { openPage } from "./shared/openBrowser.js";
import type { Command } from "../contracts/command.js";
import { t } from "../lang/index.js";

const NAME_COLUMN_WIDTH = 16;

export const helpCommand: Command = {
  name: "help",
  aliases: ["h"],
  get description() {
    return t("cmd.help");
  },
  usage: "/help",
  examples: ["/help"],
  gitSteps: [],
  allowsInvalidConfig: true,
  run: async (ctx) => {
    const lines = ctx.commands.map((command) => `  /${command.name.padEnd(NAME_COLUMN_WIDTH)}${command.description}`);
    ctx.ui.log(lines.join("\n"));
    await openPage(ctx, PAGE_ROUTES.help);
  },
};

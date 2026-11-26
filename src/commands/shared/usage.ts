import type { Command, CommandContext } from "../../contracts/command.js";
import { t } from "../../lang/index.js";

/** Argument manquant ou sous-commande inconnue : rappelle l'usage déclaré par la commande elle-même. */
export function warnUsage(ctx: CommandContext, command: Pick<Command, "usage">): void {
  ctx.ui.log(t("msg.usage", { usage: command.usage }), "warn");
}

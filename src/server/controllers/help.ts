import type { Command } from "../../contracts/command.js";
import type { Config } from "../../core/config/schema.js";
import { buildHelpData, type HelpData } from "../services/help.js";

export type HelpController = { read(): Promise<HelpData> };

export function createHelpController(commands: readonly Command[], readConfig: () => Promise<Config>): HelpController {
  return { read: () => buildHelpData(commands, readConfig) };
}

import type { Command } from "../../contracts/command.js";
import { redactApiKeys } from "../../core/config/apiKeys.js";
import { describeConfigOptions, type Config, type ConfigOptionDoc } from "../../core/config/schema.js";

export type CommandHelp = {
  name: string;
  aliases: readonly string[];
  usage: string;
  description: string;
  examples: readonly string[];
  gitSteps: readonly string[];
};

export type HelpData = {
  commands: CommandHelp[];
  configOptions: ConfigOptionDoc[];
  effectiveConfig: Config | null;
};

export async function buildHelpData(commands: readonly Command[], readConfig: () => Promise<Config>): Promise<HelpData> {
  return {
    commands: commands.map(toCommandHelp),
    configOptions: describeConfigOptions(),
    effectiveConfig: await readEffectiveConfig(readConfig),
  };
}

function toCommandHelp(command: Command): CommandHelp {
  return {
    name: command.name,
    aliases: command.aliases ?? [],
    usage: command.usage,
    description: command.description,
    examples: command.examples,
    gitSteps: command.gitSteps,
  };
}

/** L'aide reste lisible même avec une configuration cassée : la page affiche alors un message à la place. */
async function readEffectiveConfig(readConfig: () => Promise<Config>): Promise<Config | null> {
  try {
    return redactApiKeys(await readConfig());
  } catch {
    return null;
  }
}

import type { CommitMessageGenerator } from "../core/ai/provider.js";
import { DEFAULT_CONFIG, type Config } from "../core/config/schema.js";
import { ConfigError, GitError, GitPushError, messageOf } from "../core/errors.js";
import type { GitClient } from "../core/git/gitClient.js";
import { syncIgnoredPatterns } from "../core/git/localExclude.js";
import { countChanges, describeBranch, describeRepoState, getStatus } from "../core/git/status.js";
import { setLanguage, t } from "../lang/index.js";
import { parseInput } from "../commands/parseInput.js";
import { findCommand, suggestInput } from "../commands/suggest.js";
import type { Command, CommandContext, CommandUi, ConfigPaths, WebServer } from "../contracts/command.js";
import type { HeaderState, ReplSession } from "../contracts/session.js";

/** Tout vient du container : la session ne crée aucune dépendance elle-même. */
export type SessionDependencies = {
  git: GitClient;
  silentGit: GitClient;
  commands: readonly Command[];
  ui: CommandUi;
  web: WebServer;
  resolvePaths: () => Promise<ConfigPaths>;
  readConfig: () => Promise<Config>;
  createAi: (config: Config) => CommitMessageGenerator;
  exit: () => void;
};

export function createSession(dependencies: SessionDependencies): ReplSession {
  const { git, silentGit, commands, ui, web, resolvePaths, readConfig, createAi, exit } = dependencies;

  const buildContext = (client: GitClient, config: Config, paths: ConfigPaths): CommandContext => ({
    git: client,
    config,
    ui,
    ai: createAi(config),
    commands,
    web,
    paths,
    exit,
  });

  const applyIgnoredFiles = async (): Promise<void> => {
    if (!(await resolvePaths()).repo) return;
    try {
      await syncIgnoredPatterns(silentGit, (await readConfig()).ignore);
    } catch (error) {
      // Une config invalide est signalée par la commande : on garde les motifs déjà appliqués.
      if (!(error instanceof ConfigError)) throw error;
    }
  };

  const runCommand = async (command: Command, args: string[]): Promise<void> => {
    await applyIgnoredFiles();
    const config = await resolveConfig(command, readConfig, ui);
    setLanguage(config.language);
    await command.run(buildContext(git, config, await resolvePaths()), args);
    // Après /config ou /init : l'en-tête reflète les nouveaux motifs sans attendre la commande suivante.
    await applyIgnoredFiles();
  };

  return {
    async execute(line) {
      const parsed = parseInput(line);
      if (!parsed) {
        ui.log(t("session.startWithSlash"), "warn");
        return;
      }
      const command = findCommand(commands, parsed.name);
      if (!command) {
        ui.log(t("session.unknownCommand", { name: parsed.name }), "error");
        return;
      }
      try {
        await runCommand(command, parsed.args);
      } catch (error) {
        await reportError(error, ui, silentGit);
      }
    },
    suggest: (input) => suggestInput(commands, input, async () => buildContext(silentGit, await readConfig(), await resolvePaths())),
    readHeader: () => readHeaderState(silentGit),
  };
}

async function resolveConfig(command: Command, readConfig: () => Promise<Config>, ui: CommandUi): Promise<Config> {
  try {
    return await readConfig();
  } catch (error) {
    if (!(error instanceof ConfigError) || !command.allowsInvalidConfig) throw error;
    ui.log(error.message, "error");
    return DEFAULT_CONFIG;
  }
}

async function reportError(error: unknown, ui: CommandUi, silentGit: GitClient): Promise<void> {
  if (!(error instanceof GitPushError)) {
    ui.log(t("session.unexpectedError", { message: messageOf(error) }), "error");
    return;
  }
  ui.log(error.message, "error");
  if (error instanceof GitError) await reportRepoState(ui, silentGit);
}

async function reportRepoState(ui: CommandUi, silentGit: GitClient): Promise<void> {
  try {
    const state = await describeRepoState(silentGit);
    if (state) ui.log(t("session.repoState", { state }), "warn");
  } catch {
    ui.log(t("session.repoStateUnavailable"), "warn");
  }
}

async function readHeaderState(silentGit: GitClient): Promise<HeaderState | undefined> {
  try {
    const status = await getStatus(silentGit, { listEachUntrackedFile: true });
    return { branch: describeBranch(status), changes: countChanges(status.files) };
  } catch {
    return undefined;
  }
}

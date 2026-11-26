import { commands as registeredCommands } from "../commands/registry.js";
import type { Command, ConfigPaths } from "../contracts/command.js";
import type { SessionFactory } from "../contracts/session.js";
import { createGeneratorFromConfig } from "../core/ai/generator.js";
import { ensureGlobalConfig, loadConfig, repoConfigPath } from "../core/config/loadConfig.js";
import type { Config } from "../core/config/schema.js";
import { ConfigError } from "../core/errors.js";
import { createGitClient } from "../core/git/gitClient.js";
import { getRepoRoot } from "../core/git/status.js";
import { setLanguage } from "../lang/index.js";
import { createWebServer } from "./server.js";
import { createSession } from "./session.js";

export type ContainerOptions = {
  launchDirectory: string;
  globalConfigPath: string;
  env: NodeJS.ProcessEnv;
  commands?: readonly Command[];
};

export type Container = {
  /** Racine du dépôt si git-push est lancé dans un sous-dossier, sinon le dossier de lancement. */
  cwd: string;
  startSession: SessionFactory;
};

/** Seul endroit qui assemble les dépendances : git, configuration, IA, serveur web et session. */
export async function createContainer(options: ContainerOptions): Promise<Container> {
  const { globalConfigPath, env, commands = registeredCommands } = options;
  const cwd = (await getRepoRoot(createGitClient({ cwd: options.launchDirectory }))) ?? options.launchDirectory;
  await ensureGlobalConfig(globalConfigPath);
  await applySavedLanguage(globalConfigPath);

  const silentGit = createGitClient({ cwd });
  // Relu à chaque commande : /init peut créer le dépôt en cours de session.
  const resolvePaths = async (): Promise<ConfigPaths> => {
    const repoRoot = await getRepoRoot(silentGit);
    return { global: globalConfigPath, repo: repoRoot ? repoConfigPath(repoRoot) : undefined };
  };
  const readConfig = async (): Promise<Config> => {
    const paths = await resolvePaths();
    return loadConfig({ globalPath: paths.global, repoPath: paths.repo });
  };
  const web = createWebServer({ git: silentGit, commands, readConfig, readPaths: resolvePaths });

  return {
    cwd,
    startSession: (ui, onGitCommand, exit) =>
      createSession({
        git: createGitClient({ cwd, onCommand: onGitCommand }),
        silentGit,
        commands,
        ui,
        web,
        resolvePaths,
        readConfig,
        createAi: (config) => createGeneratorFromConfig(config.ai, env),
        exit,
      }),
  };
}

/** Avant le premier rendu : l'en-tête doit déjà être dans la bonne langue. Une config invalide est signalée par la session. */
async function applySavedLanguage(globalConfigPath: string): Promise<void> {
  try {
    setLanguage((await loadConfig({ globalPath: globalConfigPath })).language);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
  }
}

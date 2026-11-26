import { commands as registeredCommands } from "../commands/registry.js";
import type { Command, ConfigPaths, WebServer } from "../contracts/command.js";
import type { SessionFactory } from "../contracts/session.js";
import { createGeneratorFromConfig } from "../core/ai/generator.js";
import { ensureGlobalConfig, loadConfig, loadConfigAt, resolveRepoConfigPath } from "../core/config/loadConfig.js";
import type { Config } from "../core/config/schema.js";
import { ConfigError } from "../core/errors.js";
import { createGitClient } from "../core/git/gitClient.js";
import type { GitClient } from "../core/git/gitClient.js";
import { getRepoRoot } from "../core/git/status.js";
import { setLanguage } from "../lang/index.js";
import { createConfigController } from "./controllers/config.js";
import { createHelpController } from "./controllers/help.js";
import { createLogController } from "./controllers/log.js";
import { createWebServer } from "./server.js";
import { createSession } from "./session.js";

export type ContainerOptions = {
  launchDirectory: string;
  globalConfigPath: string;
  env: NodeJS.ProcessEnv;
  commands?: readonly Command[];
};

export type Container = {
  /** Racine du dépôt si git-commit est lancé dans un sous-dossier, sinon le dossier de lancement. */
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
    return { global: globalConfigPath, repo: repoRoot ? await resolveRepoConfigPath(repoRoot) : undefined };
  };
  const readConfig = async (): Promise<Config> => loadConfigAt(await resolvePaths());
  const web = createWebApp({ git: silentGit, commands, readConfig, readPaths: resolvePaths });

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
        env,
        exit,
      }),
  };
}

export type WebAppDependencies = {
  git: GitClient;
  commands: readonly Command[];
  readConfig: () => Promise<Config>;
  readPaths: () => Promise<ConfigPaths>;
};

/** Serveur web complet : un controller par page, chacun branché sur ses services. */
export function createWebApp({ git, commands, readConfig, readPaths }: WebAppDependencies): WebServer {
  return createWebServer({
    controllers: {
      config: createConfigController(readPaths),
      log: createLogController(git),
      help: createHelpController(commands, readConfig),
    },
    readPort: async () => (await readConfig()).web.port,
  });
}

/** Avant le premier rendu : l'en-tête doit déjà être dans la bonne langue. Une config invalide est signalée par la session. */
async function applySavedLanguage(globalConfigPath: string): Promise<void> {
  try {
    setLanguage((await loadConfig({ globalPath: globalConfigPath })).language);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
  }
}

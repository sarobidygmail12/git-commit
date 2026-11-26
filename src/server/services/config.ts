import { redactApiKeys } from "../../core/config/apiKeys.js";
import { isGlobalOnlyPath, loadConfigAt } from "../../core/config/loadConfig.js";
import { getValueAt, resolveConfigTarget, setConfigValues, type ConfigChange } from "../../core/config/saveConfig.js";
import { describeConfigOptions, type ConfigOptionDoc, type ConfigOptionKind } from "../../core/config/schema.js";
import { setLanguage } from "../../lang/index.js";

export type RepoConfigPaths = { global: string; repo: string };

export type ConfigOptionView = {
  path: string;
  type: string;
  description: string;
  kind: ConfigOptionKind;
  choices: readonly string[];
  value: unknown;
  isGlobalOnly: boolean;
};

export type ConfigPageData = { file: string; options: ConfigOptionView[] };

export type ConfigSaveResult = { savedTo: string; page: ConfigPageData };

/** Les valeurs affichées sont celles qui s'appliquent dans ce dépôt : le global surchargé par `.git-push.json`. */
export async function readRepoConfigPage(paths: RepoConfigPaths): Promise<ConfigPageData> {
  const config = redactApiKeys(await loadConfigAt(paths));
  return {
    file: paths.repo,
    options: describeConfigOptions().map((option) => toOptionView(option, getValueAt(config, option.path))),
  };
}

/**
 * Écrit les modifications dans `.git-push.json`, validées ensemble avant toute écriture.
 * La langue s'applique tout de suite : la prochaine page et la session l'utilisent sans redémarrage.
 */
export async function saveRepoConfig(paths: RepoConfigPaths, changes: readonly ConfigChange[]): Promise<ConfigSaveResult> {
  await setConfigValues(resolveConfigTarget(paths, "repo"), changes);
  setLanguage((await loadConfigAt(paths)).language);
  return { savedTo: paths.repo, page: await readRepoConfigPage(paths) };
}

export function listOptionPaths(): string[] {
  return describeConfigOptions().map((option) => option.path);
}

function toOptionView(option: ConfigOptionDoc, value: unknown): ConfigOptionView {
  return {
    path: option.path,
    type: option.type,
    description: option.description,
    kind: option.kind,
    choices: option.choices,
    value,
    isGlobalOnly: isGlobalOnlyPath(option.path),
  };
}

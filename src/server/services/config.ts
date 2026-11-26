import { writeFile } from "node:fs/promises";
import { execa, parseCommandString } from "execa";
import { redactApiKeys } from "../../core/config/apiKeys.js";
import { isGlobalOnlyPath, loadConfigAt } from "../../core/config/loadConfig.js";
import { getValueAt, resolveConfigTarget, setConfigValues, type ConfigChange } from "../../core/config/saveConfig.js";
import { describeConfigOptions, type ConfigOptionDoc, type ConfigOptionKind } from "../../core/config/schema.js";
import { hasErrorCode } from "../../core/errors.js";
import { setLanguage } from "../../lang/index.js";

const DEFAULT_EDITOR = "vi";
const EMPTY_CONFIG_FILE = "{}\n";

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

/** Les valeurs affichées sont celles qui s'appliquent dans ce dépôt : le global surchargé par `.git-commit.json`. */
export async function readRepoConfigPage(paths: RepoConfigPaths): Promise<ConfigPageData> {
  const config = redactApiKeys(await loadConfigAt(paths));
  return {
    file: paths.repo,
    options: describeConfigOptions().map((option) => toOptionView(option, getValueAt(config, option.path))),
  };
}

/**
 * Écrit les modifications dans `.git-commit.json`, validées ensemble avant toute écriture.
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

/** Ouvre le fichier dans `$VISUAL`, sinon `$EDITOR`, sinon vi ; le terminal est rendu à l'éditeur jusqu'à sa fermeture. */
export async function openInEditor(path: string, env: Readonly<Record<string, string | undefined>>): Promise<void> {
  const [editor = DEFAULT_EDITOR, ...editorArgs] = parseCommandString(env["VISUAL"] ?? env["EDITOR"] ?? DEFAULT_EDITOR);
  await execa(editor, [...editorArgs, path], { stdio: "inherit" });
}

/** Crée un `.git-commit.json` vide s'il n'existe pas, sans jamais écraser un fichier présent. */
export async function createConfigFileIfMissing(path: string): Promise<void> {
  try {
    await writeFile(path, EMPTY_CONFIG_FILE, { flag: "wx" });
  } catch (error) {
    if (!hasErrorCode(error, "EEXIST")) throw error;
  }
}

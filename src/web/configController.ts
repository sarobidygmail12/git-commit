import { z } from "zod";
import type { ConfigPaths } from "../commands/types.js";
import { redactApiKeys } from "../core/config/apiKeys.js";
import { isGlobalOnlyPath, loadConfig } from "../core/config/loadConfig.js";
import { getValueAt, resolveConfigTarget, setConfigValues, type ConfigChange } from "../core/config/saveConfig.js";
import { describeConfigOptions, type ConfigOptionDoc, type ConfigOptionKind } from "../core/config/schema.js";
import { setLanguage, t } from "../lang/index.js";
import { HTTP_BAD_REQUEST, RequestError } from "./requestError.js";

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

export type ConfigController = {
  read(): Promise<ConfigPageData>;
  save(body: unknown): Promise<ConfigSaveResult>;
};

export function createConfigController(readPaths: () => Promise<ConfigPaths>): ConfigController {
  return {
    async read() {
      return readConfigPage(requireRepoPaths(await readPaths()));
    },
    async save(body) {
      const paths = requireRepoPaths(await readPaths());
      const changes = parseChanges(body);
      await setConfigValues(resolveConfigTarget(paths, "repo"), changes);
      setLanguage((await loadConfig({ globalPath: paths.global, repoPath: paths.repo })).language);
      return { savedTo: paths.repo, page: await readConfigPage(paths) };
    },
  };
}

type RepoConfigPaths = { global: string; repo: string };

/** La page ne modifie que le dépôt courant : hors d'un dépôt, il n'y a rien à afficher. */
function requireRepoPaths(paths: ConfigPaths): RepoConfigPaths {
  if (!paths.repo) throw new RequestError(HTTP_BAD_REQUEST, t("config.repoNeeded"));
  return { global: paths.global, repo: paths.repo };
}

/** Les valeurs affichées sont celles qui s'appliquent dans ce dépôt : le global surchargé par `.git-push.json`. */
async function readConfigPage(paths: RepoConfigPaths): Promise<ConfigPageData> {
  const config = redactApiKeys(await loadConfig({ globalPath: paths.global, repoPath: paths.repo }));
  return {
    file: paths.repo,
    options: describeConfigOptions().map((option) => toOptionView(option, getValueAt(config, option.path))),
  };
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

/** Seules les options connues sont acceptées : le corps ne peut écrire aucune autre clé dans le fichier. */
function parseChanges(body: unknown): ConfigChange[] {
  const optionPaths = describeConfigOptions().map((option) => option.path);
  const knownPaths = new Set(optionPaths);
  const requestSchema = z.strictObject({
    changes: z
      .array(z.strictObject({ path: z.string().refine((path) => knownPaths.has(path)), value: z.unknown() }))
      .min(1)
      .max(optionPaths.length),
  });
  const result = requestSchema.safeParse(body);
  if (!result.success) throw new RequestError(HTTP_BAD_REQUEST, t("server.invalidChanges"));
  return result.data.changes.map((change) => ({ path: change.path, value: change.value }));
}

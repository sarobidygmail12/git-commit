import { z } from "zod";
import { HTTP_BAD_REQUEST } from "../../constants/http.js";
import type { ConfigPaths } from "../../contracts/command.js";
import type { ConfigChange } from "../../core/config/saveConfig.js";
import { t } from "../../lang/index.js";
import { RequestError } from "../http/requestError.js";
import {
  listOptionPaths,
  readRepoConfigPage,
  saveRepoConfig,
  type ConfigPageData,
  type ConfigSaveResult,
  type RepoConfigPaths,
} from "../services/config.js";

export type ConfigController = {
  read(): Promise<ConfigPageData>;
  save(body: unknown): Promise<ConfigSaveResult>;
};

export function createConfigController(readPaths: () => Promise<ConfigPaths>): ConfigController {
  return {
    async read() {
      return readRepoConfigPage(requireRepoPaths(await readPaths()));
    },
    async save(body) {
      const paths = requireRepoPaths(await readPaths());
      return saveRepoConfig(paths, parseChanges(body));
    },
  };
}

/** La page ne modifie que le dépôt courant : hors d'un dépôt, il n'y a rien à afficher. */
function requireRepoPaths(paths: ConfigPaths): RepoConfigPaths {
  if (!paths.repo) throw new RequestError(HTTP_BAD_REQUEST, t("config.repoNeeded"));
  return { global: paths.global, repo: paths.repo };
}

/** Seules les options connues sont acceptées : le corps ne peut écrire aucune autre clé dans le fichier. */
function parseChanges(body: unknown): ConfigChange[] {
  const optionPaths = listOptionPaths();
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

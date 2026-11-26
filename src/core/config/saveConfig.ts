import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { OWNER_ONLY_FILE_MODE, SHARED_FILE_MODE, UNSAFE_OBJECT_KEYS } from "../../constants/files.js";
import { ConfigError, GitCommitError } from "../errors.js";
import { tryParseJson } from "../json.js";
import {
  assertRepoOverrideAllowed,
  isJsonObject,
  mergeDeep,
  readJsonObject,
  serializeConfig,
  toJsonObject,
  validateConfig,
  type JsonObject,
} from "./loadConfig.js";
import { DEFAULT_CONFIG } from "./schema.js";
import { t } from "../../lang/index.js";


export type ConfigTarget =
  | { scope: "global"; path: string }
  | { scope: "repo"; path: string; globalPath: string };

export type ConfigScope = ConfigTarget["scope"];

export type ConfigChange = { path: string; value: unknown };

export function resolveConfigTarget(paths: { global: string; repo: string | undefined }, scope: ConfigScope): ConfigTarget {
  if (scope === "global") return { scope: "global", path: paths.global };
  if (!paths.repo) throw new GitCommitError(t("config.repoNeeded"));
  return { scope: "repo", path: paths.repo, globalPath: paths.global };
}

/** Une valeur texte est encodée en JSON : une branche nommée « 123 » serait sinon lue comme un nombre. */
export function encodeTextValue(text: string): string {
  return JSON.stringify(text);
}

export async function setConfigValue(target: ConfigTarget, dottedPath: string, rawValue: string): Promise<void> {
  await setConfigValues(target, [{ path: dottedPath, value: parseValue(rawValue) }]);
}

/** Valide l'ensemble avant d'écrire : une seule modification invalide laisse le fichier intact. */
export async function setConfigValues(target: ConfigTarget, changes: readonly ConfigChange[]): Promise<void> {
  const file = (await readJsonObject(target.path)) ?? {};
  const updated = changes.reduce(
    (current, change) => withValueAt(current, parseSegments(change.path, target.path), change.value),
    file,
  );
  await assertValid(target, updated);
  await writeAtomically(target.path, updated, target.scope === "global" ? OWNER_ONLY_FILE_MODE : SHARED_FILE_MODE);
}

export function getValueAt(root: unknown, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((node, segment) => (isJsonObject(node) ? node[segment] : undefined), root);
}

async function assertValid(target: ConfigTarget, updated: JsonObject): Promise<void> {
  const defaults = toJsonObject(DEFAULT_CONFIG);
  if (target.scope === "global") {
    validateConfig(mergeDeep(defaults, updated), target.path);
    return;
  }
  assertRepoOverrideAllowed(updated, target.path);
  const globalFile = (await readJsonObject(target.globalPath)) ?? {};
  validateConfig(mergeDeep(mergeDeep(defaults, globalFile), updated), target.path);
}

function parseSegments(dottedPath: string, sourcePath: string): string[] {
  const segments = dottedPath.split(".");
  if (segments.some((segment) => segment === "" || UNSAFE_OBJECT_KEYS.has(segment))) {
    throw new ConfigError(sourcePath, [t("config.issuePath", { path: dottedPath })]);
  }
  return segments;
}

/** `true`, `12` ou `["a"]` sont lus comme du JSON ; le reste est une chaîne. */
function parseValue(rawValue: string): unknown {
  const parsed = tryParseJson(rawValue);
  return parsed.ok ? parsed.value : rawValue;
}

function withValueAt(object: JsonObject, [head, ...rest]: string[], value: unknown): JsonObject {
  if (head === undefined) return object;
  if (rest.length === 0) return { ...object, [head]: value };
  const child = object[head];
  return { ...object, [head]: withValueAt(isJsonObject(child) ? child : {}, rest, value) };
}

async function writeAtomically(path: string, content: JsonObject, mode: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, serializeConfig(content), { mode });
  await rename(temporaryPath, path);
}

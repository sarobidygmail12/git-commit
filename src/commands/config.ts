import { PAGE_ROUTES } from "../constants/routes.js";
import { redactApiKeys } from "../core/config/apiKeys.js";
import { loadConfigAt, readJsonObject, serializeConfig } from "../core/config/loadConfig.js";
import { encodeTextValue, getValueAt, resolveConfigTarget, setConfigValue, type ConfigTarget } from "../core/config/saveConfig.js";
import { DEFAULT_CONFIG, describeConfigOptions, type Config, type ConfigOptionDoc } from "../core/config/schema.js";
import { ConfigError, GitCommitError } from "../core/errors.js";
import { openPage } from "./shared/openBrowser.js";
import { warnUsage } from "./shared/usage.js";
import type { Command, CommandContext } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { createConfigFileIfMissing, openInEditor } from "../server/services/config.js";

const REPO_FLAG = "--repo";
const SUBCOMMANDS = ["browse", "show", "set", "edit"];

export const configCommand: Command = {
  name: "config",
  get description() {
    return t("cmd.config");
  },
  usage: "/config [browse | show | set path value | edit] [--repo]",
  examples: [
    "/config",
    "/config browse",
    "/config show",
    "/config set commit.autoPush false",
    "/config set --repo branches.develop dev",
    "/config edit",
  ],
  gitSteps: [],
  allowsInvalidConfig: true,
  completeArgs: () => Promise.resolve(SUBCOMMANDS),
  run: async (ctx, args) => {
    const useRepo = args.includes(REPO_FLAG);
    const [subcommand, path, ...valueParts] = args.filter((arg) => arg !== REPO_FLAG);
    if (subcommand === undefined) return openConfigPage(ctx);
    if (subcommand === "browse") return browseConfig(ctx, useRepo);
    if (subcommand === "show") return showConfig(ctx);
    if (subcommand === "edit") return editConfig(ctx, useRepo);
    if (subcommand === "set" && path !== undefined && valueParts.length > 0) {
      await setConfigValue(resolveTarget(ctx, useRepo), path, restoreListQuotes(path, valueParts.join(" ")));
      ctx.ui.log(t("config.updated", { path }), "success");
      return;
    }
    warnUsage(ctx, configCommand);
  },
};

/** Le parseur de commandes retire les `"` : `["a","b"]` arrive ici sous la forme `[a,b]`. */
function restoreListQuotes(path: string, rawValue: string): string {
  const isBracketed = rawValue.startsWith("[") && rawValue.endsWith("]");
  if (!isBracketed || !Array.isArray(getValueAt(DEFAULT_CONFIG, path))) return rawValue;
  const items = rawValue.slice(1, -1).split(",").map((item) => item.trim()).filter((item) => item !== "");
  return JSON.stringify(items);
}

function showConfig(ctx: CommandContext): void {
  ctx.ui.log(`${describeLocations(ctx)}\n\n${serializeConfig(redactApiKeys(ctx.config))}`);
}

function describeLocations(ctx: CommandContext): string {
  const repoLine = ctx.paths.repo ? `\n${t("config.locationRepo", { path: ctx.paths.repo })}` : "";
  return `${t("config.locationGlobal", { path: ctx.paths.global })}${repoLine}`;
}

/** La page n'édite que `.git-commit.json` du dépôt courant. */
async function openConfigPage(ctx: CommandContext): Promise<void> {
  if (!ctx.paths.repo) throw new GitCommitError(t("config.pageNeedsRepo"));
  await openPage(ctx, PAGE_ROUTES.config);
}

async function browseConfig(ctx: CommandContext, useRepo: boolean): Promise<void> {
  ctx.ui.log(describeLocations(ctx));
  await browseFrom(ctx, ctx.config, useRepo);
}

/** Réaffiche la liste après chaque modification, curseur sur l'option modifiée, jusqu'à Échap. */
async function browseFrom(ctx: CommandContext, config: Config, useRepo: boolean, initial?: string): Promise<void> {
  const options = describeConfigOptions();
  const choices = options.map((option) => toChoice(option, redactApiKeys(config)));
  const selectedPath = await ctx.ui.select(t("config.browse"), choices, initial === undefined ? undefined : { initial });
  const selected = options.find((option) => option.path === selectedPath);
  if (!selected) return;
  await browseFrom(ctx, await editOption(ctx, config, selected, useRepo), useRepo, selected.path);
}

function toChoice(option: ConfigOptionDoc, config: Config): { label: string; value: string } {
  return { label: `${option.path} = ${formatValue(getValueAt(config, option.path))}`, value: option.path };
}

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Renvoie la configuration à afficher ensuite : inchangée si la saisie est annulée ou refusée. */
async function editOption(ctx: CommandContext, config: Config, option: ConfigOptionDoc, useRepo: boolean): Promise<Config> {
  const current = getValueAt(config, option.path);
  const initial = formatValue(getValueAt(redactApiKeys(config), option.path));
  const answer = (await ctx.ui.ask(`${option.path} : ${option.description}`, { initial }))?.trim();
  if (answer === undefined || answer === initial) return config;

  try {
    const target = await resolveEditTarget(ctx, option.path, useRepo);
    await setConfigValue(target, option.path, typeof current === "string" ? encodeTextValue(answer) : answer);
    ctx.ui.log(t("config.updatedIn", { path: option.path, file: target.path }), "success");
    return await loadConfigAt(ctx.paths);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    ctx.ui.log(error.message, "error");
    return config;
  }
}

/** Une option déjà définie par le dépôt s'y modifie : écrite en global, elle resterait sans effet. */
async function resolveEditTarget(ctx: CommandContext, path: string, useRepo: boolean): Promise<ConfigTarget> {
  if (useRepo || !ctx.paths.repo) return resolveTarget(ctx, useRepo);
  const repoFile = await readJsonObject(ctx.paths.repo);
  return resolveTarget(ctx, getValueAt(repoFile, path) !== undefined);
}

function resolveTarget(ctx: CommandContext, useRepo: boolean): ConfigTarget {
  return resolveConfigTarget(ctx.paths, useRepo ? "repo" : "global");
}

async function editConfig(ctx: CommandContext, useRepo: boolean): Promise<void> {
  const target = resolveTarget(ctx, useRepo);
  if (target.scope === "repo") await createConfigFileIfMissing(target.path);
  await ctx.ui.runExternal(() => openInEditor(target.path, ctx.env));
  await loadConfigAt(ctx.paths);
  ctx.ui.log(t("config.valid"), "success");
}

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_REMOTE } from "../../constants/git.js";
import { GitError } from "../../core/errors.js";
import type { GitClient } from "../../core/git/gitClient.js";
import { getStatus } from "../../core/git/status.js";
import { t } from "../../lang/index.js";

const HOME_PREFIX = "~/";

/** Le shell n'intervient pas ici : sans cela, `~/projet` créerait un dossier nommé `~`. */
export function resolveDirectory(cwd: string, typed: string): string {
  if (typed === "~") return homedir();
  return resolve(cwd, typed.startsWith(HOME_PREFIX) ? join(homedir(), typed.slice(HOME_PREFIX.length)) : typed);
}

/** Une URL lue comme option (`--upload-pack=…`) ou contenant un espace n'atteint jamais git. */
export function assertValidRemoteUrl(url: string): void {
  const hasWhitespace = [...url].some((character) => character.trim() === "");
  if (url.startsWith("-") || hasWhitespace) throw new GitError(t("init.invalidUrl", { url }));
}

/** Part du dossier existant le plus proche : un sous-dossier encore absent d'un dépôt est quand même dans ce dépôt. */
export async function findRepoRootOf(git: GitClient, directory: string): Promise<string | undefined> {
  const { stdout, exitCode } = await git.run(["-C", nearestExistingDirectory(directory), "rev-parse", "--show-toplevel"], {
    allowFailure: true,
  });
  return exitCode === 0 && stdout !== "" ? stdout : undefined;
}

function nearestExistingDirectory(path: string): string {
  return existsSync(path) || dirname(path) === path ? path : nearestExistingDirectory(dirname(path));
}

export async function hasDefaultRemoteAt(git: GitClient, root: string): Promise<boolean> {
  const { exitCode } = await git.run(["-C", root, "remote", "get-url", DEFAULT_REMOTE], { allowFailure: true });
  return exitCode === 0;
}

export async function initRepository(git: GitClient, directory: string, mainBranch: string): Promise<void> {
  await git.run(["init", "-b", mainBranch, directory]);
}

export async function addDefaultRemote(git: GitClient, root: string, url: string): Promise<void> {
  await git.run(["-C", root, "remote", "add", DEFAULT_REMOTE, url]);
}

/** Met de côté tout le working tree, fichiers non suivis compris. */
export async function stashAll(git: GitClient, message?: string): Promise<void> {
  await git.run(message === undefined ? ["stash", "push", "-u"] : ["stash", "push", "-u", "-m", message]);
}

export async function popStash(git: GitClient): Promise<string> {
  const { stdout } = await git.run(["stash", "pop"]);
  return stdout;
}

export async function listStashes(git: GitClient): Promise<string> {
  const { stdout } = await git.run(["stash", "list"]);
  return stdout;
}

export type DiffSummary = { staged: string; unstaged: string; untracked: string[] };

export async function readDiffSummary(git: GitClient): Promise<DiffSummary> {
  const staged = await git.run(["diff", "--cached", "--stat"]);
  const unstaged = await git.run(["diff", "--stat"]);
  const { files } = await getStatus(git);
  return {
    staged: staged.stdout,
    unstaged: unstaged.stdout,
    untracked: files.filter((file) => file.kind === "untracked").map((file) => file.path),
  };
}

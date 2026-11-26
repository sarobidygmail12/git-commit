import type { Config } from "../../core/config/schema.js";
import { GitError } from "../../core/errors.js";
import { branchExists, isValidBranchName } from "../../core/git/branches.js";
import type { GitClient } from "../../core/git/gitClient.js";
import { assertNoOperationInProgress, getStatus } from "../../core/git/status.js";
import { t } from "../../lang/index.js";

const OPTION_PREFIX = "-";

/**
 * Seule définition d'une branche protégée : les trois branches de base plus `branches.protected`.
 * /commit et /rebase demandent confirmation dessus, /delete-branch refuse de les supprimer.
 */
export function listProtectedBranches({ branches }: Config): string[] {
  return [...new Set([branches.main, branches.develop, branches.preprod, ...branches.protected])];
}

export function isProtectedBranch(config: Config, branch: string): boolean {
  return listProtectedBranches(config).includes(branch);
}

/** Un nom qui commence par `-` serait lu par git comme une option : refusé avant tout appel. */
export async function assertValidBranchName(git: GitClient, name: string): Promise<void> {
  if (name.startsWith(OPTION_PREFIX) || !(await isValidBranchName(git, name))) {
    throw new GitError(t("branch.invalidName", { name }));
  }
}

/** Crée la branche et s'y place ; les modifications en cours la suivent. */
export async function createBranch(git: GitClient, name: string): Promise<{ hadChanges: boolean }> {
  await assertValidBranchName(git, name);
  if (await branchExists(git, name)) throw new GitError(t("branch.exists", { name }));
  await assertNoOperationInProgress(git);
  const { files } = await getStatus(git);
  await git.run(["switch", "-c", name]);
  return { hadChanges: files.length > 0 };
}

export async function switchToBranch(git: GitClient, name: string): Promise<void> {
  await git.run(["switch", name]);
}

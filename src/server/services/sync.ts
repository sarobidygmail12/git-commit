import { DEFAULT_REMOTE, REMOTE_PREFIX } from "../../constants/git.js";
import { GitError } from "../../core/errors.js";
import type { GitClient, GitResult } from "../../core/git/gitClient.js";
import { getOperationInProgress, getStatus, isConflict, isConflictResolved, type RepoStatus } from "../../core/git/status.js";
import { t } from "../../lang/index.js";

export type SequenceOperation = "cherry-pick" | "rebase";

export async function fetchAllRemotes(git: GitClient): Promise<void> {
  await git.run(["fetch", "--all"]);
}

export async function fetchFromDefaultRemote(git: GitClient, ref?: string): Promise<void> {
  await git.run(ref === undefined ? ["fetch", DEFAULT_REMOTE] : ["fetch", DEFAULT_REMOTE, ref]);
}

export async function pullFastForward(git: GitClient): Promise<string> {
  const { stdout } = await git.run(["pull", "--ff-only"]);
  return stdout;
}

export async function forcePushWithLease(git: GitClient): Promise<void> {
  await git.run(["push", "--force-with-lease"], { destructiveConfirmed: true });
}

/** Une branche locale et son upstream ont chacun des commits que l'autre n'a pas : après un rebase, typiquement. */
export function hasDiverged(status: RepoStatus): boolean {
  return status.upstream !== undefined && status.ahead > 0 && status.behind > 0;
}

/** Jamais poussée, ou en avance sur son upstream. */
export function hasUnpushedCommits(status: RepoStatus): boolean {
  return !status.upstream || status.ahead > 0;
}

export async function assertHasDefaultRemote(git: GitClient): Promise<void> {
  const { exitCode } = await git.run(["remote", "get-url", DEFAULT_REMOTE], { allowFailure: true });
  if (exitCode !== 0) throw new GitError(t("firstPush.noRemote", { remote: DEFAULT_REMOTE }));
}

/** Commits présents sur `origin/<branche>` mais pas en local ; 0 si la branche n'existe pas encore sur le remote. */
export async function countMissingRemoteCommits(git: GitClient, branch: string): Promise<number> {
  const remoteRef = `${REMOTE_PREFIX}${DEFAULT_REMOTE}/${branch}`;
  const { exitCode } = await git.run(["show-ref", "--verify", "--quiet", remoteRef], { allowFailure: true });
  if (exitCode !== 0) return 0;
  const { stdout } = await git.run(["rev-list", "--count", `HEAD..${remoteRef}`]);
  return Number(stdout);
}

export async function isSequenceRunning(git: GitClient, operation: SequenceOperation): Promise<boolean> {
  return (await getOperationInProgress(git)) === operation;
}

/** Un conflit laisse la séquence en cours (à reprendre avec /rebase ou /cherry-pick) ; seul un échec au démarrage lève. */
export async function startRebase(git: GitClient, target: string): Promise<void> {
  await startSequence(git, "rebase", [target]);
}

export async function startCherryPick(git: GitClient, hashes: readonly string[]): Promise<void> {
  await startSequence(git, "cherry-pick", hashes);
}

async function startSequence(git: GitClient, operation: SequenceOperation, targets: readonly string[]): Promise<void> {
  const args = [operation, ...targets];
  const result = await git.run(args, { allowFailure: true });
  if (result.exitCode === 0 || (await isSequenceRunning(git, operation))) return;
  throw failureOf(args, result);
}

export async function abortSequence(git: GitClient, operation: SequenceOperation): Promise<void> {
  await git.run([operation, "--abort"]);
}

export async function skipSequenceStep(git: GitClient, operation: SequenceOperation): Promise<void> {
  await git.run([operation, "--skip"], { allowFailure: true });
}

export async function listConflicts(git: GitClient): Promise<string[]> {
  const { files } = await getStatus(git);
  return files.filter(isConflict).map((file) => file.path);
}

export type ContinueOutcome = { kind: "unresolved"; paths: string[] } | { kind: "continued"; warning?: string };

/** Marque les conflits résolus puis reprend ; refuse tant qu'un fichier garde des marqueurs de conflit. */
export async function continueSequence(
  git: GitClient,
  operation: SequenceOperation,
  conflicts: readonly string[],
): Promise<ContinueOutcome> {
  const resolved = await Promise.all(conflicts.map((path) => isConflictResolved(git, path)));
  const unresolved = conflicts.filter((_path, index) => !resolved[index]);
  if (unresolved.length > 0) return { kind: "unresolved", paths: unresolved };
  if (conflicts.length > 0) await git.run(["add", "--", ...conflicts]);
  const result = await git.run([operation, "--continue"], { allowFailure: true });
  return result.exitCode === 0 ? { kind: "continued" } : { kind: "continued", warning: result.stderr || result.stdout };
}

function failureOf(args: readonly string[], result: GitResult): GitError {
  const output = result.stderr || result.stdout;
  return new GitError(output, { args, exitCode: result.exitCode, stderr: output });
}

import type { Config } from "../../core/config/schema.js";
import { GitError } from "../../core/errors.js";
import { assertHeadNotPushed, countHeadParents, readHeadMessage } from "../../core/git/commits.js";
import type { GitClient } from "../../core/git/gitClient.js";
import { isSensitivePath } from "../../core/git/sensitive.js";
import { assertNoOperationInProgress, getStatus, isStaged, type FileChange } from "../../core/git/status.js";
import { t } from "../../lang/index.js";

export async function stageAll(git: GitClient): Promise<void> {
  await git.run(["add", "."]);
}

/** Renvoie la première ligne de la sortie de git (`[branche hash] titre`), à afficher telle quelle. */
export async function commitStaged(git: GitClient, message: string): Promise<string | undefined> {
  const { stdout } = await git.run(["commit", "-m", message]);
  return stdout.split("\n")[0];
}

/** Fichiers sensibles qui partiraient dans le commit : tout le working tree si `commit.addAll`, sinon l'index. */
export function findSensitivePaths(config: Config, files: readonly FileChange[]): string[] {
  const candidates = config.commit.addAll ? files : files.filter(isStaged);
  return candidates.map((file) => file.path).filter(isSensitivePath);
}

/** Réécrire HEAD n'est permis que sur un commit local, hors opération en cours. */
export async function assertCanRewriteHead(git: GitClient): Promise<void> {
  await assertNoOperationInProgress(git);
  await assertHeadNotPushed(git, await getStatus(git));
}

export type HeadMessage = { subject: string; body: readonly string[] };

export async function readHeadMessageParts(git: GitClient): Promise<HeadMessage> {
  const [subject = "", ...body] = (await readHeadMessage(git)).split("\n");
  return { subject, body };
}

/** Garde le détail du message : seul le titre change. Sans nouveau titre, `--no-edit` conserve le message. */
export async function amendHead(git: GitClient, current: HeadMessage, subject: string): Promise<void> {
  const messageArgs = subject === current.subject ? ["--no-edit"] : ["-m", [subject, ...current.body].join("\n")];
  await git.run(["commit", "--amend", ...messageArgs]);
}

/** Annule le dernier commit local en gardant ses modifications indexées. */
export async function undoLastCommit(git: GitClient): Promise<void> {
  await assertCanRewriteHead(git);
  const parents = await countHeadParents(git);
  if (parents === 0) throw new GitError(t("undo.firstCommit"));
  if (parents > 1) throw new GitError(t("undo.merge"));
  await git.run(["reset", "--soft", "HEAD~1"]);
}

export async function readLastSubject(git: GitClient): Promise<string> {
  const { stdout } = await git.run(["log", "-1", "--format=%s"]);
  return stdout;
}

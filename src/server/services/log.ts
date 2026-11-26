import type { GitClient } from "../../core/git/gitClient.js";
import {
  getCommitDetails,
  getFileDiff,
  getLogPage,
  getRepoOverview,
  type CommitDetails,
  type FileDiff,
  type LogPage,
  type LogQuery,
  type RepoOverview,
} from "../../core/git/log.js";

/** Historique affiché par la page /log : les requêtes git restent dans core, les règles de lecture ici. */
export function readLogPage(git: GitClient, query: LogQuery): Promise<LogPage> {
  return getLogPage(git, query);
}

export function readRepoOverview(git: GitClient): Promise<RepoOverview> {
  return getRepoOverview(git);
}

export function readCommitDetails(git: GitClient, hash: string): Promise<CommitDetails> {
  return getCommitDetails(git, hash);
}

export function readFileDiff(git: GitClient, hash: string, path: string): Promise<FileDiff> {
  return getFileDiff(git, hash, path);
}

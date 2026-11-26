import { HTTP_BAD_REQUEST } from "../../constants/http.js";
import type { GitClient } from "../../core/git/gitClient.js";
import {
  isCommitHash,
  LOG_SEARCH_FIELDS,
  type CommitDetails,
  type LogPage,
  type LogQuery,
  type RepoOverview,
} from "../../core/git/log.js";
import { t } from "../../lang/index.js";
import { RequestError } from "../http/requestError.js";
import { readCommitDetails, readLogPage, readRepoOverview } from "../services/log.js";

export type LogController = {
  readPage(url: URL): Promise<LogPage>;
  readOverview(): Promise<RepoOverview>;
  readCommit(url: URL): Promise<CommitDetails>;
};

export function createLogController(git: GitClient): LogController {
  return {
    readPage: (url) => readLogPage(git, parseLogQuery(url)),
    readOverview: () => readRepoOverview(git),
    readCommit: (url) => readCommitDetails(git, parseHash(url)),
  };
}

/** Une page ou un champ invalide retombe sur la valeur par défaut : la page reste utilisable avec une URL bricolée. */
export function parseLogQuery(url: URL): LogQuery {
  const page = Number(url.searchParams.get("page") ?? "0");
  const field = LOG_SEARCH_FIELDS.find((candidate) => candidate === url.searchParams.get("field")) ?? "message";
  return {
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    search: url.searchParams.get("search")?.trim() ?? "",
    field,
    branch: url.searchParams.get("branch") ?? "",
  };
}

function parseHash(url: URL): string {
  const hash = url.searchParams.get("hash") ?? "";
  if (!isCommitHash(hash)) throw new RequestError(HTTP_BAD_REQUEST, t("log.invalidHash", { hash }));
  return hash;
}

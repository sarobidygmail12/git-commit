import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitFlow } from "../src/commands/shared/commitFlow.js";
import { rebaseCommand } from "../src/commands/rebase.js";
import { DEFAULT_CONFIG, type Config } from "../src/core/config/schema.js";
import { GitError } from "../src/core/errors.js";
import { createGitClient } from "../src/core/git/gitClient.js";
import type { FileChange, RepoStatus } from "../src/core/git/status.js";
import { assertValidBranchName, isProtectedBranch, listProtectedBranches } from "../src/server/services/branch.js";
import { findSensitivePaths } from "../src/server/services/commit.js";
import { assertValidRemoteUrl, resolveDirectory } from "../src/server/services/repo.js";
import { hasDiverged, hasUnpushedCommits } from "../src/server/services/sync.js";
import { createFakeContext } from "./helpers/fakeContext.js";
import { createTempRepo, type TempRepo } from "./helpers/tempRepo.js";

const withBranches = (branches: Partial<Config["branches"]>): Config => ({
  ...DEFAULT_CONFIG,
  branches: { ...DEFAULT_CONFIG.branches, ...branches },
});

const statusWith = (fields: Partial<RepoStatus>): RepoStatus => ({
  branch: "feature/a",
  upstream: "origin/feature/a",
  ahead: 0,
  behind: 0,
  headHash: "abc1234",
  files: [],
  ...fields,
});

const UNCHANGED = ".";
const MODIFIED = "M";
const stagedFile = (path: string): FileChange => ({ path, kind: "tracked", index: MODIFIED, worktree: UNCHANGED });
const unstagedFile = (path: string): FileChange => ({ path, kind: "tracked", index: UNCHANGED, worktree: MODIFIED });

describe("service branch : une seule règle de branche protégée", () => {
  it("protège les trois branches de base et branches.protected, sans doublon", () => {
    expect(listProtectedBranches(withBranches({ protected: ["main", "release"] }))).toEqual(["main", "develop", "preprod", "release"]);
  });

  it("suit les noms configurés des branches de base", () => {
    const config = withBranches({ develop: "dev", protected: [] });
    expect(isProtectedBranch(config, "dev")).toBe(true);
    expect(isProtectedBranch(config, "develop")).toBe(false);
    expect(isProtectedBranch(config, "feature/a")).toBe(false);
  });

  it("refuse un nom lu comme une option ou invalide pour git", async () => {
    const git = createGitClient({ cwd: process.cwd() });
    await expect(assertValidBranchName(git, "-")).rejects.toBeInstanceOf(GitError);
    await expect(assertValidBranchName(git, "--force")).rejects.toBeInstanceOf(GitError);
    await expect(assertValidBranchName(git, "a..b")).rejects.toBeInstanceOf(GitError);
    await expect(assertValidBranchName(git, "feature/cart")).resolves.toBeUndefined();
  });
});

describe("règle unique appliquée par les commandes", () => {
  let repo: TempRepo;

  beforeEach(() => {
    repo = createTempRepo();
  });
  afterEach(() => repo.cleanup());

  it("/commit demande confirmation sur develop, même absente de branches.protected", async () => {
    repo.git("switch", "--quiet", "develop");
    repo.write("file.txt", "modifié\n");
    const ctx = createFakeContext(repo.work, { confirm: false });
    const confirm = vi.spyOn(ctx.ui, "confirm");

    expect(await commitFlow(ctx)).toBe("cancelled");
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("develop"));
    expect(repo.git("diff", "--cached", "--name-only")).toBe("");
  });

  it("/rebase demande confirmation avant de réécrire preprod", async () => {
    repo.git("switch", "--quiet", "preprod");
    const ctx = createFakeContext(repo.work, { confirm: false });
    const confirm = vi.spyOn(ctx.ui, "confirm");

    await rebaseCommand.run(ctx, ["develop"]);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("preprod"));
  });
});

describe("services commit, sync et repo", () => {
  it("ne regarde que l'index quand commit.addAll est désactivé", () => {
    const files = [unstagedFile(".env"), stagedFile("src/a.ts"), stagedFile("id_rsa")];
    expect(findSensitivePaths(DEFAULT_CONFIG, files)).toEqual([".env", "id_rsa"]);
    const stagedOnly: Config = { ...DEFAULT_CONFIG, commit: { ...DEFAULT_CONFIG.commit, addAll: false } };
    expect(findSensitivePaths(stagedOnly, files)).toEqual(["id_rsa"]);
  });

  it("reconnaît une branche divergée et des commits non poussés", () => {
    expect(hasDiverged(statusWith({ ahead: 1, behind: 1 }))).toBe(true);
    expect(hasDiverged(statusWith({ ahead: 1, behind: 0 }))).toBe(false);
    expect(hasDiverged(statusWith({ upstream: undefined, ahead: 1, behind: 1 }))).toBe(false);
    expect(hasUnpushedCommits(statusWith({ upstream: undefined }))).toBe(true);
    expect(hasUnpushedCommits(statusWith({ ahead: 2 }))).toBe(true);
    expect(hasUnpushedCommits(statusWith({}))).toBe(false);
  });

  it("refuse une URL de remote lue comme une option ou contenant un espace", () => {
    expect(() => assertValidRemoteUrl("--upload-pack=x")).toThrow(GitError);
    expect(() => assertValidRemoteUrl("git@host:a b.git")).toThrow(GitError);
    expect(() => assertValidRemoteUrl("git@github.com:moi/projet.git")).not.toThrow();
  });

  it("résout un dossier relatif au dossier courant", () => {
    expect(resolveDirectory("/tmp/base", "projet")).toBe("/tmp/base/projet");
    expect(resolveDirectory("/tmp/base", "/abs")).toBe("/abs");
  });
});

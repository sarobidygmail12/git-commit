import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amendCommand } from "../src/commands/amend.js";
import { cherryPickCommand } from "../src/commands/cherryPick.js";
import { diffCommand } from "../src/commands/diff.js";
import { pullCommand } from "../src/commands/pull.js";
import { pushCommand } from "../src/commands/push.js";
import { stashCommand } from "../src/commands/stash.js";
import { statusCommand } from "../src/commands/status.js";
import { switchCommand } from "../src/commands/switch.js";
import type { CommandContext } from "../src/contracts/command.js";
import { GitError } from "../src/core/errors.js";
import { createFakeContext, type FakeAnswers } from "./helpers/fakeContext.js";
import { createTempRepo, type TempRepo } from "./helpers/tempRepo.js";

const BRANCH_AND_CLEAN_LINES = 2;

describe("commandes sur un vrai dépôt", () => {
  let repo: TempRepo;

  beforeEach(() => {
    repo = createTempRepo();
  });
  afterEach(() => repo.cleanup());

  const contextWith = (answers: FakeAnswers = {}): CommandContext => createFakeContext(repo.work, answers);
  const logged = (ctx: CommandContext): string[] => vi.mocked(ctx.ui.log).mock.calls.map(([message]) => message);
  const subject = (): string => repo.git("log", "-1", "--format=%s");

  describe("/amend", () => {
    beforeEach(() => {
      repo.git("switch", "--quiet", "-c", "feature/amend");
      repo.commit("a.txt", "a\n", "feat: premier titre");
    });

    it("remplace le titre du dernier commit local", async () => {
      await amendCommand.run(contextWith(), ["fix:", "nouveau", "titre"]);
      expect(subject()).toBe("fix: nouveau titre");
    });

    it("demande le titre et garde le commit si la saisie est annulée", async () => {
      const ctx = contextWith({ ask: [] });
      await amendCommand.run(ctx, []);
      expect(subject()).toBe("feat: premier titre");
      expect(logged(ctx)).toContain("Amend annulé.");
    });

    it("inclut les modifications en cours si l'utilisateur accepte", async () => {
      repo.write("a.txt", "a modifié\n");
      await amendCommand.run(contextWith({ confirm: true }), ["feat: premier titre"]);
      expect(repo.git("status", "--porcelain")).toBe("");
      expect(repo.git("show", "HEAD:a.txt")).toBe("a modifié");
    });

    it("ne fait rien si le titre est identique et rien n'est indexé", async () => {
      const head = repo.git("rev-parse", "HEAD");
      const ctx = contextWith({ confirm: false });
      await amendCommand.run(ctx, ["feat: premier titre"]);
      expect(repo.git("rev-parse", "HEAD")).toBe(head);
    });

    it("refuse un commit déjà poussé", async () => {
      repo.git("push", "--quiet", "-u", "origin", "feature/amend");
      await expect(amendCommand.run(contextWith(), ["autre"])).rejects.toBeInstanceOf(GitError);
    });
  });

  describe("/switch", () => {
    it("change de branche sur un arbre propre", async () => {
      await switchCommand.run(contextWith(), ["develop"]);
      expect(repo.git("branch", "--show-current")).toBe("develop");
    });

    it("refuse un nom qui ressemble à une option", async () => {
      await expect(switchCommand.run(contextWith(), ["--force"])).rejects.toBeInstanceOf(GitError);
    });

    it("rappelle l'usage sans argument", async () => {
      const ctx = contextWith();
      await switchCommand.run(ctx, []);
      expect(logged(ctx)[0]).toContain("/switch <branch>");
    });

    it("met les modifications de côté si l'utilisateur choisit stash", async () => {
      repo.write("file.txt", "modifié\n");
      await switchCommand.run(contextWith({ select: "stash" }), ["develop"]);
      expect(repo.git("branch", "--show-current")).toBe("develop");
      expect(repo.git("stash", "list")).toContain("git-commit : avant /switch develop");
    });

    it("reste sur place si l'utilisateur renonce", async () => {
      repo.write("file.txt", "modifié\n");
      await switchCommand.run(contextWith(), ["develop"]);
      expect(repo.git("branch", "--show-current")).toBe("main");
    });
  });

  describe("/stash", () => {
    it("met de côté puis restaure les modifications, fichiers non suivis compris", async () => {
      repo.write("nouveau.txt", "x\n");
      await stashCommand.run(contextWith(), []);
      expect(repo.git("status", "--porcelain")).toBe("");

      await stashCommand.run(contextWith(), ["pop"]);
      expect(repo.git("status", "--porcelain")).toContain("nouveau.txt");
    });

    it("annonce qu'il n'y a rien à mettre de côté", async () => {
      const ctx = contextWith();
      await stashCommand.run(ctx, []);
      expect(repo.git("stash", "list")).toBe("");
      expect(logged(ctx)).toHaveLength(1);
    });

    it("liste les stashes ou dit qu'il n'y en a aucun", async () => {
      const empty = contextWith();
      await stashCommand.run(empty, ["list"]);
      const emptyMessage = logged(empty)[0];

      repo.write("file.txt", "modifié\n");
      repo.git("stash", "push", "--quiet", "-m", "travail");
      const filled = contextWith();
      await stashCommand.run(filled, ["list"]);
      expect(logged(filled)[0]).toContain("travail");
      expect(logged(filled)[0]).not.toBe(emptyMessage);
    });

    it("rappelle l'usage sur une sous-commande inconnue", async () => {
      const ctx = contextWith();
      await stashCommand.run(ctx, ["drop"]);
      expect(logged(ctx)[0]).toContain("/stash [pop|list]");
    });
  });

  describe("/cherry-pick", () => {
    it("applique un commit d'une autre branche", async () => {
      repo.git("switch", "--quiet", "develop");
      repo.commit("picked.txt", "p\n", "feat: à reprendre");
      const hash = repo.git("rev-parse", "HEAD");
      repo.git("switch", "--quiet", "main");

      await cherryPickCommand.run(contextWith(), [hash]);
      expect(subject()).toBe("feat: à reprendre");
    });

    it("refuse un hash invalide sans rien lancer", async () => {
      await expect(cherryPickCommand.run(contextWith(), ["pas-un-hash"])).rejects.toBeInstanceOf(GitError);
    });

    it("rappelle l'usage sans hash", async () => {
      const ctx = contextWith();
      await cherryPickCommand.run(ctx, []);
      expect(logged(ctx)[0]).toContain("/cherry-pick <hash...>");
    });
  });

  describe("/status", () => {
    it("annonce un arbre propre avec la branche et son upstream", async () => {
      const ctx = contextWith();
      await statusCommand.run(ctx, []);
      expect(logged(ctx)[0]).toBe("main → origin/main  en avance : 0, en retard : 0");
      expect(logged(ctx)).toHaveLength(BRANCH_AND_CLEAN_LINES);
    });

    it("classe les fichiers indexés et modifiés", async () => {
      repo.write("file.txt", "modifié\n");
      repo.write("indexe.txt", "i\n");
      repo.git("add", "indexe.txt");
      const ctx = contextWith();
      await statusCommand.run(ctx, []);
      const sections = logged(ctx)[1] ?? "";
      expect(sections).toContain("  indexe.txt");
      expect(sections).toContain("  file.txt");
    });

    it("signale une branche sans upstream", async () => {
      repo.git("switch", "--quiet", "-c", "locale");
      const ctx = contextWith();
      await statusCommand.run(ctx, []);
      expect(logged(ctx)[0]).toBe("locale (pas d'upstream)");
    });
  });

  describe("/diff", () => {
    it("résume indexé, non indexé et non suivi", async () => {
      repo.write("file.txt", "modifié\n");
      repo.write("indexe.txt", "i\n");
      repo.git("add", "indexe.txt");
      repo.write("libre.txt", "l\n");
      const ctx = contextWith();
      await diffCommand.run(ctx, []);
      const output = logged(ctx)[0] ?? "";
      expect(output).toContain("indexe.txt");
      expect(output).toContain("file.txt");
      expect(output).toContain("Non suivis :\n  libre.txt");
    });

    it("annonce qu'il n'y a aucune modification", async () => {
      const ctx = contextWith();
      await diffCommand.run(ctx, []);
      expect(logged(ctx)).toHaveLength(1);
      expect(logged(ctx)[0]).not.toContain("file.txt");
    });
  });

  describe("/push et /pull", () => {
    it("/push envoie un commit local et pose l'upstream d'une nouvelle branche", async () => {
      repo.git("switch", "--quiet", "-c", "feature/push");
      repo.commit("p.txt", "p\n", "feat: push");
      await pushCommand.run(contextWith(), []);
      expect(repo.git("rev-parse", "origin/feature/push")).toBe(repo.git("rev-parse", "HEAD"));
    });

    it("/pull avance la branche en fast-forward", async () => {
      const remoteHead = repo.git("rev-parse", "HEAD");
      repo.commit("distant.txt", "d\n", "feat: distant");
      repo.git("push", "--quiet");
      repo.git("reset", "--quiet", "--hard", remoteHead);

      await pullCommand.run(contextWith(), []);
      expect(subject()).toBe("feat: distant");
    });
  });
});

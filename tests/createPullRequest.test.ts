import open from "open";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullRequestCommand } from "../src/commands/pullRequest.js";
import { buildPullRequestUrl, toRepositoryWebUrl } from "../src/core/git/pullRequest.js";
import { withTitleEmoji } from "../src/server/services/pullRequest.js";
import type { CommandContext } from "../src/contracts/command.js";
import { createFakeContext, type FakeAnswers } from "./helpers/fakeContext.js";
import { createTempRepo, type TempRepo } from "./helpers/tempRepo.js";

vi.mock("open", () => ({ default: vi.fn(() => Promise.resolve({ once: vi.fn() })) }));

const GITHUB_REMOTE = "git@github.com:acme/app.git";
const BRANCH = "feature/a";
const ROCKET = "%F0%9F%9A%80";
const SPARKLES = "%E2%9C%A8";
const TITLE_AND_BODY_PROMPTS = 2;

describe("/pr", () => {
  let repo: TempRepo;

  beforeEach(() => {
    vi.mocked(open).mockClear();
    repo = createTempRepo();
    repo.git("switch", "--quiet", "-c", BRANCH);
    repo.commit("a.txt", "a\n", "ajoute a");
  });
  afterEach(() => repo.cleanup());

  /** Le remote de test est un dossier local : seule l'adresse lue pour construire l'URL est remplacée. */
  const run = async (
    answers: FakeAnswers,
    remoteUrl: string = GITHUB_REMOTE,
    beforeRun: (ctx: CommandContext) => void = () => undefined,
  ): Promise<string[]> => {
    const ctx = createFakeContext(repo.work, answers);
    beforeRun(ctx);
    const realRun = ctx.git.run.bind(ctx.git);
    vi.spyOn(ctx.git, "run").mockImplementation(async (args, options) => {
      const result = await realRun(args, options);
      return args.join(" ") === "remote get-url origin" ? { ...result, stdout: remoteUrl } : result;
    });
    await pullRequestCommand.run(ctx, []);
    return vi.mocked(ctx.ui.log).mock.calls.map(([message]) => message);
  };

  const remoteHead = (): string => repo.git("ls-remote", "origin", `refs/heads/${BRANCH}`).split("\t")[0] ?? "";

  it("pousse la branche puis ouvre la page GitHub avec le titre et la description", async () => {
    const logs = await run({ ask: ["Mon titre", "Ma description"] });

    const url = `https://github.com/acme/app/compare/main...feature/a?expand=1&title=${ROCKET}+Mon+titre&body=Ma+description`;
    expect(remoteHead()).toBe(repo.git("rev-parse", "HEAD"));
    expect(open).toHaveBeenCalledWith(url);
    expect(logs).toEqual(["Termine la pull request dans ton navigateur :", url]);
  });

  it("omet une description vide", async () => {
    await run({ ask: ["Mon titre", ""] });

    expect(open).toHaveBeenCalledWith(`https://github.com/acme/app/compare/main...feature/a?expand=1&title=${ROCKET}+Mon+titre`);
  });

  it("propose le dernier commit avec son emoji, et garde celui choisi par l'utilisateur", async () => {
    repo.commit("b.txt", "b\n", "feat: panier");
    const asked: string[] = [];
    await run({ ask: ["🎉 Fête", ""] }, GITHUB_REMOTE, (ctx) => {
      const realAsk = ctx.ui.ask.bind(ctx.ui);
      vi.spyOn(ctx.ui, "ask").mockImplementation((question, options) => {
        asked.push(options?.initial ?? "");
        return realAsk(question, options);
      });
    });

    expect(asked[0]).toBe("✨ feat: panier");
    expect(asked).toHaveLength(TITLE_AND_BODY_PROMPTS);
    expect(open).toHaveBeenCalledWith(expect.stringContaining("title=%F0%9F%8E%89+F%C3%AAte"));
  });

  it("ajoute l'emoji du type si le titre tapé n'en a pas", async () => {
    await run({ ask: ["feat: panier", ""] });
    expect(open).toHaveBeenCalledWith(expect.stringContaining(`title=${SPARKLES}+feat%3A+panier`));
  });

  it.each([
    ["le titre", []],
    ["un titre vide", ["  "]],
    ["la description", ["Mon titre"]],
  ])("n'envoie rien si on annule sur %s", async (_step, ask) => {
    const logs = await run({ ask: [...ask] });

    expect(logs).toEqual(["Pull request annulée, rien n'a été envoyé."]);
    expect(remoteHead()).toBe("");
    expect(open).not.toHaveBeenCalled();
  });

  it("refuse la branche par défaut", async () => {
    repo.git("switch", "--quiet", "main");

    await expect(run({ ask: ["Mon titre", ""] })).rejects.toThrow("branche par défaut");
  });

  it("refuse un remote qui n'est pas un dépôt web, sans rien poser comme question", async () => {
    await expect(run({ ask: [] }, "/srv/git/app.git")).rejects.toThrow("dépôt GitHub");
    expect(remoteHead()).toBe("");
  });
});

describe("emoji du titre de pull request", () => {
  it.each([
    ["feat: panier", "feature/x", "✨ feat: panier"],
    ["fix(api)!: crash", "feature/x", "🚒 fix(api)!: crash"],
    ["docs: guide", "main-work", "📝 docs: guide"],
    ["Corrige le panier", "hotfix/panier", "🚑️ Corrige le panier"],
    ["Ajoute le panier", "feature/panier", "🚀 Ajoute le panier"],
    ["Corrige le calcul de la TVA", "feature/tva", "🚒 Corrige le calcul de la TVA"],
    ["Résout le crash au démarrage", "feature/crash", "🚒 Résout le crash au démarrage"],
    ["RESOLVED login loop", "feature/login", "🚒 RESOLVED login loop"],
    ["Bug du panier vide", "sans-prefixe", "🚒 Bug du panier vide"],
    ["Fix: majuscule non conventionnelle", "x", "🚒 Fix: majuscule non conventionnelle"],
    ["Corrige le panier", "fix/panier", "🚒 Corrige le panier"],
    ["Ajoute le debugger", "feature/debug", "🚀 Ajoute le debugger"],
    ["feat: corrige le parcours d'achat", "feature/x", "✨ feat: corrige le parcours d'achat"],
    ["Corrige le panier", "hotfix/panier", "🚑️ Corrige le panier"],
    ["inconnu: titre", "sans-prefixe", "🚀 inconnu: titre"],
    ["  feat: espaces  ", "x", "✨ feat: espaces"],
  ])("%s sur %s → %s", (title, branch, expected) => {
    expect(withTitleEmoji(title, branch)).toBe(expected);
  });

  it("laisse un titre qui commence déjà par un emoji, et reste stable si on l'applique deux fois", () => {
    expect(withTitleEmoji("🎉 Fête", "feature/x")).toBe("🎉 Fête");
    expect(withTitleEmoji(withTitleEmoji("fix: crash", "x"), "x")).toBe("🚒 fix: crash");
    expect(withTitleEmoji(withTitleEmoji("feat: panier", "x"), "x")).toBe("✨ feat: panier");
  });
});

describe("adresse de la pull request", () => {
  it.each([
    ["git@github.com:acme/app.git", "https://github.com/acme/app"],
    ["ssh://git@github.com/acme/app.git", "https://github.com/acme/app"],
    ["https://github.com/acme/app.git", "https://github.com/acme/app"],
    ["https://github.com/acme/app/", "https://github.com/acme/app"],
    ["https://user:secret@github.com/acme/app.git", "https://github.com/acme/app"],
  ])("comprend %s", (remote, expected) => {
    expect(toRepositoryWebUrl(remote)).toBe(expected);
  });

  it.each(["/srv/git/app.git", "file:///srv/git/app.git", "https://github.com/app"])("rejette %s", (remote) => {
    expect(toRepositoryWebUrl(remote)).toBeUndefined();
  });

  it("ouvre une merge request sur GitLab, sous-groupes compris", () => {
    const url = new URL(buildPullRequestUrl("https://gitlab.com/acme/team/app", "main", "feature/a", { title: "Titre", body: "Détail" }));

    expect(url.origin + url.pathname).toBe("https://gitlab.com/acme/team/app/-/merge_requests/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "merge_request[source_branch]": "feature/a",
      "merge_request[target_branch]": "main",
      "merge_request[title]": "Titre",
      "merge_request[description]": "Détail",
    });
  });

  it("encode les caractères spéciaux sans casser les / des branches", () => {
    const url = buildPullRequestUrl("https://github.com/acme/app", "main", "feature/a#1", { title: "a&b", body: "" });

    expect(url).toBe("https://github.com/acme/app/compare/main...feature/a%231?expand=1&title=a%26b");
  });
});

import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commands } from "../src/commands/registry.js";
import { HTTP_FORBIDDEN, HTTP_INTERNAL_ERROR, HTTP_NOT_FOUND, HTTP_OK } from "../src/constants/http.js";
import { ensureGlobalConfig } from "../src/core/config/loadConfig.js";
import { createTempRepo, type TempRepo } from "./helpers/tempRepo.js";
import { startTestServer, type TestServer } from "./helpers/webServer.js";

const PAGES = ["/", "/log", "/help", "/config"];

describe("serveur web : pages et API de lecture", () => {
  let repo: TempRepo;
  let server: TestServer;

  beforeEach(async () => {
    repo = createTempRepo();
    const paths = { global: join(repo.root, "config.json"), repo: join(repo.work, ".git-push.json") };
    await ensureGlobalConfig(paths.global);
    server = await startTestServer({ cwd: repo.work, paths, commands });
  });
  afterEach(() => repo.cleanup());

  const json = async (path: string): Promise<unknown> => {
    const reply = await server.send(path);
    expect(reply.status).toBe(HTTP_OK);
    return JSON.parse(reply.body);
  };

  it.each(PAGES)("sert %s en HTML entièrement traduit", async (path) => {
    const reply = await server.send(path);
    expect(reply.status).toBe(HTTP_OK);
    expect(reply.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(reply.body.startsWith("<!doctype html>")).toBe(true);
    expect(reply.body).not.toContain("{{web.");
  });

  it("pose les en-têtes de sécurité sur chaque réponse", async () => {
    const reply = await server.send("/log");
    expect(reply.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(reply.headers["content-security-policy"]).toContain("connect-src 'self'");
    expect(reply.headers["x-content-type-options"]).toBe("nosniff");
    expect(reply.headers["cache-control"]).toBe("no-store");
  });

  it("refuse un en-tête Host qui n'est pas local (DNS rebinding)", async () => {
    const reply = await server.send("/api/repo", { headers: { host: `evil.example:${server.baseUrl.port}` } });
    expect(reply.status).toBe(HTTP_FORBIDDEN);
  });

  it("répond 404 sur une page inconnue", async () => {
    expect((await server.send("/inconnue")).status).toBe(HTTP_NOT_FOUND);
  });

  it("/api/repo décrit le dépôt, ses branches et ses auteurs", async () => {
    expect(await json("/api/repo")).toMatchObject({
      name: "work",
      head: { branch: "main", hash: repo.git("rev-parse", "HEAD") },
      local: expect.arrayContaining([{ name: "develop", ahead: 0, behind: 0 }]),
      remote: expect.arrayContaining(["origin/main"]),
      authors: [{ name: "Test", commits: 1 }],
    });
  });

  it("/api/log pagine l'historique et filtre par message", async () => {
    repo.commit("a.txt", "a\n", "feat: ajoute a");
    const page = await json("/api/log?page=0");
    expect(page).toMatchObject({ page: 0, hasMore: false });
    expect(page).toHaveProperty("commits.0.subject", "feat: ajoute a");

    const filtered = await json("/api/log?search=initial&field=message");
    expect(filtered).toHaveProperty("commits.length", 1);
    expect(filtered).toHaveProperty("commits.0.subject", "initial");
  });

  it("/api/log ramène une page invalide à 0 et un champ inconnu au message", async () => {
    expect(await json("/api/log?page=-3&field=inconnu")).toMatchObject({ page: 0 });
  });

  it("/api/commit détaille un commit", async () => {
    repo.commit("a.txt", "a\n", "feat: ajoute a");
    const details = await json(`/api/commit?hash=${repo.git("rev-parse", "HEAD")}`);
    expect(details).toMatchObject({ committer: "Test", fileCount: 1, files: [{ path: "a.txt", added: 1, deleted: 0 }] });
  });

  it("/api/commit refuse un hash invalide", async () => {
    const reply = await server.send("/api/commit?hash=pas-un-hash");
    expect(reply.status).toBe(HTTP_INTERNAL_ERROR);
    expect(JSON.parse(reply.body)).toHaveProperty("error");
  });

  it("/api/help liste les commandes, les options et la configuration effective", async () => {
    const help = await json("/api/help");
    expect(help).toHaveProperty("commands.length", commands.length);
    expect(help).toHaveProperty("configOptions.0.path", "branches.develop");
    expect(help).toHaveProperty("effectiveConfig.branches.main", "main");
  });
});

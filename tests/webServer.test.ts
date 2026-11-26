import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commands } from "../src/commands/registry.js";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_OK } from "../src/constants/http.js";
import { ensureGlobalConfig } from "../src/core/config/loadConfig.js";
import { createTempRepo, type TempRepo } from "./helpers/tempRepo.js";
import { startTestServer, type TestServer } from "./helpers/webServer.js";

const PAGES = ["/", "/log", "/help", "/config"];

describe("serveur web : pages et API de lecture", () => {
  let repo: TempRepo;
  let server: TestServer;

  beforeEach(async () => {
    repo = createTempRepo();
    const paths = { global: join(repo.root, "config.json"), repo: join(repo.work, ".git-commit.json") };
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

  it.each(PAGES)("%s ne contient aucun style ni script inline", async (path) => {
    const { body } = await server.send(path);
    expect(body).not.toContain("<style");
    expect(body).not.toContain(" style=");
    // Script exécutable inline : `<script>` ou `<script defer>`. Ignore `<script src="/assets/app.js">` et le bloc JSON des textes.
    // https://regex101.com/?regex=%3Cscript(%3F!%5B%5E%3E%5D*%5Cbsrc%3D)(%3F!%5B%5E%3E%5D*application%5C%2Fjson)&testString=%3Cscript%3Ealert(1)%3C%2Fscript%3E%3Cscript%20src%3D%22%2Fa.js%22%3E
    expect(body.match(/<script(?![^>]*\bsrc=)(?![^>]*application\/json)/g)).toBeNull();
    expect(body).toContain('<link rel="stylesheet" href="/assets/app.css">');
  });

  it("injecte les textes traduits des scripts en JSON lisible", async () => {
    const { body } = await server.send("/config");
    const json = body.slice(body.indexOf('id="messages">') + 'id="messages">'.length, body.indexOf("</script>"));
    expect(JSON.parse(json)).toMatchObject({ save: "Enregistrer", theme: expect.any(String) });
  });

  it.each([
    ["/assets/app.css", "text/css; charset=utf-8"],
    ["/assets/app.js", "text/javascript; charset=utf-8"],
    ["/assets/log.js", "text/javascript; charset=utf-8"],
    ["/assets/help.js", "text/javascript; charset=utf-8"],
    ["/assets/config.js", "text/javascript; charset=utf-8"],
  ])("sert %s avec son type", async (path, contentType) => {
    const reply = await server.send(path);
    expect(reply.status).toBe(HTTP_OK);
    expect(reply.headers["content-type"]).toBe(contentType);
    expect(reply.body.length).toBeGreaterThan(0);
  });

  it.each(["/assets/../package.json", "/assets/secret.js", "/assets/%2e%2e/package.json"])("ne sert pas %s", async (path) => {
    expect((await server.send(path)).status).toBe(HTTP_NOT_FOUND);
  });

  it("pose les en-têtes de sécurité sur chaque réponse", async () => {
    const reply = await server.send("/log");
    expect(reply.headers["content-security-policy"]).toBe(
      "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'",
    );
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

  it("/api/commit refuse un hash invalide comme une requête invalide", async () => {
    const reply = await server.send("/api/commit?hash=pas-un-hash");
    expect(reply.status).toBe(HTTP_BAD_REQUEST);
    expect(JSON.parse(reply.body)).toHaveProperty("error");
  });

  it("/api/commit/file renvoie le diff d'un fichier du commit", async () => {
    repo.commit("a.txt", "a\n", "feat: ajoute a");
    const diff = await json(`/api/commit/file?hash=${repo.git("rev-parse", "HEAD")}&path=a.txt`);
    expect(diff).toMatchObject({ path: "a.txt", truncated: false });
    expect(diff).toHaveProperty("patch", expect.stringContaining("+a"));
  });

  it.each(["hash=pas-un-hash&path=a.txt", "hash=abcdef&path=", "hash=abcdef"])(
    "/api/commit/file refuse une requête invalide (%s)",
    async (query) => {
      const reply = await server.send(`/api/commit/file?${query}`);
      expect(reply.status).toBe(HTTP_BAD_REQUEST);
      expect(JSON.parse(reply.body)).toHaveProperty("error");
    },
  );

  it("/api/help liste les commandes, les options et la configuration effective", async () => {
    const help = await json("/api/help");
    expect(help).toHaveProperty("commands.length", commands.length);
    expect(help).toHaveProperty("configOptions.0.path", "branches.develop");
    expect(help).toHaveProperty("effectiveConfig.branches.main", "main");
  });
});

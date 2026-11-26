import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConfigPaths } from "../src/contracts/command.js";
import { HTTP_BAD_REQUEST, HTTP_FORBIDDEN, HTTP_METHOD_NOT_ALLOWED, HTTP_NOT_FOUND, HTTP_OK, HTTP_PAYLOAD_TOO_LARGE, HTTP_UNPROCESSABLE_CONTENT, HTTP_UNSUPPORTED_MEDIA_TYPE, MAX_REQUEST_BODY_BYTES } from "../src/constants/http.js";
import { ensureGlobalConfig, loadConfig } from "../src/core/config/loadConfig.js";
import { DEFAULT_CONFIG, describeConfigOptions } from "../src/core/config/schema.js";
import { ConfigError } from "../src/core/errors.js";
import { getLanguage, setLanguage } from "../src/lang/index.js";
import { createConfigController } from "../src/server/controllers/config.js";
import type { ConfigOptionView } from "../src/server/services/config.js";
import { RequestError } from "../src/server/http/requestError.js";
import { startTestServer, type Reply, type SendOptions, type TestServer } from "./helpers/webServer.js";

const OVERSIZED_BODY_BYTES = MAX_REQUEST_BODY_BYTES + 1;
const CUSTOM_WEB_PORT = 5000;
const API_KEY = "gsk_AbCdEfGhIjKl";

describe("contrôleur de configuration", () => {
  let directory: string;
  let paths: ConfigPaths;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "git-push-controller-"));
    paths = { global: join(directory, "config.json"), repo: join(directory, ".git-push.json") };
    await ensureGlobalConfig(paths.global);
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    setLanguage("fr");
  });

  const controller = () => createConfigController(() => Promise.resolve(paths));
  const optionAt = (options: readonly ConfigOptionView[], path: string): ConfigOptionView | undefined =>
    options.find((option) => option.path === path);
  const saved = () => loadConfig({ globalPath: paths.global, repoPath: paths.repo });

  describe("lecture", () => {
    it("renvoie chaque option du schéma avec sa valeur et son type de champ", async () => {
      const page = await controller().read();

      expect(page.file).toBe(paths.repo);
      expect(page.options.map((option) => option.path)).toEqual(describeConfigOptions().map((option) => option.path));
      expect(optionAt(page.options, "commit.autoPush")).toMatchObject({ kind: "boolean", value: true });
      expect(optionAt(page.options, "commit.convention")).toMatchObject({ kind: "choice", choices: ["conventional", "free"] });
      expect(optionAt(page.options, "web.port")).toMatchObject({ kind: "number", value: DEFAULT_CONFIG.web.port });
      expect(optionAt(page.options, "branches.protected")).toMatchObject({ kind: "list", value: ["main", "preprod"] });
      expect(optionAt(page.options, "ai.fallbackOrder")?.choices).toEqual(["groq", "gemini", "ollama", "fallback"]);
      expect(optionAt(page.options, "branches.main")).toMatchObject({ kind: "text", value: "main" });
    });

    it("affiche les valeurs du dépôt par-dessus le global", async () => {
      writeFileSync(paths.global, JSON.stringify({ branches: { main: "production" } }));
      writeFileSync(paths.repo ?? "", JSON.stringify({ branches: { preprod: "staging" } }));
      const page = await controller().read();

      expect(optionAt(page.options, "branches.preprod")?.value).toBe("staging");
      expect(optionAt(page.options, "branches.main")?.value).toBe("production");
    });

    it("verrouille les options réservées au global", async () => {
      const page = await controller().read();

      expect(optionAt(page.options, "ai.groq.apiKeyEnv")?.isGlobalOnly).toBe(true);
      expect(optionAt(page.options, "ai.ollama.baseUrl")?.isGlobalOnly).toBe(true);
      expect(optionAt(page.options, "ai.groq.model")?.isGlobalOnly).toBe(false);
    });

    it("masque une clé API écrite par erreur dans apiKeyEnv", async () => {
      writeFileSync(paths.global, JSON.stringify({ ai: { groq: { apiKeyEnv: API_KEY } } }));
      const value = optionAt((await controller().read()).options, "ai.groq.apiKeyEnv")?.value;
      expect(value).not.toContain(API_KEY);
    });

    it("refuse hors d'un dépôt Git", async () => {
      paths = { global: paths.global, repo: undefined };
      await expect(controller().read()).rejects.toMatchObject({ status: HTTP_BAD_REQUEST });
    });

    it("signale une configuration invalide au lieu de la masquer", async () => {
      writeFileSync(paths.repo ?? "", JSON.stringify({ commit: { convention: "inconnue" } }));
      await expect(controller().read()).rejects.toBeInstanceOf(ConfigError);
    });
  });

  describe("enregistrement", () => {
    it("écrit seulement les modifications dans .git-push.json, sans toucher au global", async () => {
      const before = readFileSync(paths.global, "utf8");
      const result = await controller().save({
        changes: [
          { path: "commit.autoPush", value: false },
          { path: "branches.protected", value: ["main", "release"] },
          { path: "web.port", value: CUSTOM_WEB_PORT },
        ],
      });

      expect(JSON.parse(readFileSync(paths.repo ?? "", "utf8"))).toEqual({
        commit: { autoPush: false },
        branches: { protected: ["main", "release"] },
        web: { port: CUSTOM_WEB_PORT },
      });
      expect(readFileSync(paths.global, "utf8")).toBe(before);
      expect(result.savedTo).toBe(paths.repo);
      expect(optionAt(result.page.options, "commit.autoPush")?.value).toBe(false);
    });

    it("garde les réglages déjà présents dans le fichier du dépôt", async () => {
      writeFileSync(paths.repo ?? "", JSON.stringify({ branches: { preprod: "staging" } }));
      await controller().save({ changes: [{ path: "branches.develop", value: "dev" }] });

      const config = await saved();
      expect(config.branches.preprod).toBe("staging");
      expect(config.branches.develop).toBe("dev");
    });

    it("n'écrit rien si une seule des modifications est invalide", async () => {
      const saving = controller().save({
        changes: [
          { path: "branches.main", value: "production" },
          { path: "ai.provider", value: "inconnu" },
        ],
      });

      await expect(saving).rejects.toBeInstanceOf(ConfigError);
      await expect(saving).rejects.toMatchObject({ issues: [expect.stringContaining("ai.provider")] });
      expect(existsSync(paths.repo ?? "")).toBe(false);
    });

    it("refuse une option réservée au global", async () => {
      const saving = controller().save({ changes: [{ path: "ai.groq.apiKeyEnv", value: "OTHER_KEY" }] });
      await expect(saving).rejects.toBeInstanceOf(ConfigError);
    });

    it("refuse hors d'un dépôt Git", async () => {
      paths = { global: paths.global, repo: undefined };
      const saving = controller().save({ changes: [{ path: "branches.main", value: "x" }] });
      await expect(saving).rejects.toMatchObject({ status: HTTP_BAD_REQUEST });
    });

    it.each([
      ["un chemin inconnu", { changes: [{ path: "commit.surprise", value: true }] }],
      ["une clé interdite", { changes: [{ path: "__proto__.polluted", value: true }] }],
      ["une section entière", { changes: [{ path: "commit", value: {} }] }],
      ["aucune modification", { changes: [] }],
      ["un champ en trop", { changes: [{ path: "branches.main", value: "x" }], scope: "global" }],
      ["un corps qui n'est pas un objet", "branches.main=x"],
    ])("refuse %s sans rien écrire", async (_case, body) => {
      await expect(controller().save(body)).rejects.toMatchObject({ status: HTTP_BAD_REQUEST });
      expect(existsSync(paths.repo ?? "")).toBe(false);
    });

    it("applique tout de suite la nouvelle langue", async () => {
      await controller().save({ changes: [{ path: "language", value: "de" }] });
      expect(getLanguage()).toBe("de");
    });
  });
});

describe("serveur web : /config et /api/config", () => {
  let directory: string;
  let paths: ConfigPaths;
  let server: TestServer;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "git-push-server-"));
    paths = { global: join(directory, "config.json"), repo: join(directory, ".git-push.json") };
    await ensureGlobalConfig(paths.global);
    server = await startTestServer({ cwd: directory, paths });
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  const send = (path: string, options?: SendOptions): Promise<Reply> => server.send(path, options);
  const sameOriginJson = (): Record<string, string> => server.sameOriginJson();
  const saveBody = JSON.stringify({ changes: [{ path: "branches.main", value: "production" }] });
  const savedMain = async (): Promise<string> =>
    (await loadConfig({ globalPath: paths.global, repoPath: paths.repo })).branches.main;

  it("sert la page de configuration traduite", async () => {
    const reply = await send("/config");
    expect(reply.status).toBe(HTTP_OK);
    expect(reply.body).toContain('id="form"');
    expect(reply.body).not.toContain("{{web.");
  });

  it("renvoie les options en JSON", async () => {
    const reply = await send("/api/config");
    expect(reply.status).toBe(HTTP_OK);
    expect(JSON.parse(reply.body)).toMatchObject({ file: paths.repo });
  });

  it("enregistre une requête JSON de même origine", async () => {
    const reply = await send("/api/config", { method: "POST", headers: sameOriginJson(), body: saveBody });
    expect(reply.status).toBe(HTTP_OK);
    expect(JSON.parse(reply.body)).toMatchObject({ savedTo: paths.repo });
    expect(await savedMain()).toBe("production");
  });

  it.each([
    ["sans en-tête Origin", { "content-type": "application/json" }],
    ["depuis un autre site", { origin: "https://evil.example", "content-type": "application/json" }],
    ["depuis un autre port local", { origin: "http://localhost:1", "content-type": "application/json" }],
  ])("refuse une écriture %s", async (_case, headers) => {
    const reply = await send("/api/config", { method: "POST", headers, body: saveBody });
    expect(reply.status).toBe(HTTP_FORBIDDEN);
    expect(await savedMain()).toBe("main");
  });

  it("refuse un formulaire HTML envoyé en text/plain", async () => {
    const headers = { origin: server.baseUrl.origin, "content-type": "text/plain" };
    const reply = await send("/api/config", { method: "POST", headers, body: saveBody });
    expect(reply.status).toBe(HTTP_UNSUPPORTED_MEDIA_TYPE);
    expect(await savedMain()).toBe("main");
  });

  it("refuse un JSON mal formé", async () => {
    const reply = await send("/api/config", { method: "POST", headers: sameOriginJson(), body: "{" });
    expect(reply.status).toBe(HTTP_BAD_REQUEST);
  });

  it("refuse un corps trop volumineux", async () => {
    const body = "x".repeat(OVERSIZED_BODY_BYTES);
    const reply = await send("/api/config", { method: "POST", headers: sameOriginJson(), body });
    expect(reply.status).toBe(HTTP_PAYLOAD_TOO_LARGE);
  });

  it("renvoie les problèmes de validation avec un statut 422", async () => {
    const body = JSON.stringify({ changes: [{ path: "web.port", value: 0 }] });
    const reply = await send("/api/config", { method: "POST", headers: sameOriginJson(), body });
    expect(reply.status).toBe(HTTP_UNPROCESSABLE_CONTENT);
    expect(JSON.parse(reply.body)).toMatchObject({ issues: [expect.stringContaining("web.port")] });
  });

  it("n'accepte POST que sur les routes d'écriture", async () => {
    const reply = await send("/api/help", { method: "POST", headers: sameOriginJson(), body: "{}" });
    expect(reply.status).toBe(HTTP_NOT_FOUND);
  });

  it("refuse les autres méthodes", async () => {
    const reply = await send("/api/config", { method: "PUT", headers: sameOriginJson(), body: saveBody });
    expect(reply.status).toBe(HTTP_METHOD_NOT_ALLOWED);
  });
});

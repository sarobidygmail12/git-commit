import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Command, ConfigPaths, WebServer } from "../contracts/command.js";
import { redactApiKeys } from "../core/config/apiKeys.js";
import { describeConfigOptions, type Config } from "../core/config/schema.js";
import { t, translatePage } from "../lang/index.js";
import { ConfigError, GitPushError, hasErrorCode, messageOf } from "../core/errors.js";
import { tryParseJson } from "../core/json.js";
import type { GitClient } from "../core/git/gitClient.js";
import { getCommitDetails, getLogPage, getRepoOverview, type LogQuery, type LogSearchField } from "../core/git/log.js";
import { createConfigController } from "./controllers/config.js";
import {
  HTML_CONTENT_TYPE,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_PAYLOAD_TOO_LARGE,
  HTTP_UNPROCESSABLE_CONTENT,
  HTTP_UNSUPPORTED_MEDIA_TYPE,
  JSON_CONTENT_TYPE,
  JSON_MEDIA_TYPE,
  MAX_REQUEST_BODY_BYTES,
  TEXT_CONTENT_TYPE,
} from "../constants/http.js";
import { API_ROUTES, PAGE_ROUTES } from "../constants/routes.js";
import { RequestError } from "./http/requestError.js";

const LOOPBACK_ADDRESS = "127.0.0.1";
const ALLOWED_HOSTNAMES = ["localhost", LOOPBACK_ADDRESS];
const PORT_ATTEMPTS = 10;
const SEARCH_FIELDS: readonly LogSearchField[] = ["message", "author", "hash"];
const CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'";

const ALLOWED_METHODS = ["GET", "POST"];

export type WebServerDependencies = {
  git: GitClient;
  commands: readonly Command[];
  readConfig: () => Promise<Config>;
  readPaths: () => Promise<ConfigPaths>;
};

type RouteResult = { status: number; contentType: string; body: string };
type RouteRequest = { url: URL; body: unknown };
/** Clé `"<méthode> <chemin>"` : une route d'écriture n'est jamais atteinte en GET, ni l'inverse. */
type Route = (request: RouteRequest) => Promise<RouteResult>;

export function createWebServer(dependencies: WebServerDependencies): WebServer {
  let startedUrl: string | undefined;
  return {
    async ensureStarted() {
      startedUrl ??= await start(dependencies);
      return startedUrl;
    },
  };
}

async function start(dependencies: WebServerDependencies): Promise<string> {
  const { web } = await dependencies.readConfig();
  const routes = createRoutes(dependencies);
  const server = createServer((request, response) => void handleRequest(routes, request, response));
  const port = await listenOnFirstFreePort(server, web.port, PORT_ATTEMPTS);
  server.unref();
  return `http://localhost:${port}`;
}

/** Deux git-push ouverts sur deux dépôts doivent chacun servir le leur. */
async function listenOnFirstFreePort(server: Server, port: number, attemptsLeft: number): Promise<number> {
  if (attemptsLeft === 0) throw new GitPushError(t("server.noPort", { port: port - PORT_ATTEMPTS }));
  try {
    await listen(server, port);
    return port;
  } catch (error) {
    if (hasErrorCode(error, "EADDRINUSE")) {
      return listenOnFirstFreePort(server, port + 1, attemptsLeft - 1);
    }
    throw error;
  }
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(port, LOOPBACK_ADDRESS, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function createRoutes({ git, commands, readConfig, readPaths }: WebServerDependencies): Map<string, Route> {
  const configController = createConfigController(readPaths);
  return new Map<string, Route>([
    [`GET ${PAGE_ROUTES.home}`, () => servePage("log.html")],
    [`GET ${PAGE_ROUTES.log}`, () => servePage("log.html")],
    [`GET ${PAGE_ROUTES.help}`, () => servePage("help.html")],
    [`GET ${PAGE_ROUTES.config}`, () => servePage("config.html")],
    [`GET ${API_ROUTES.log}`, async ({ url }) => jsonResult(await getLogPage(git, parseLogQuery(url)))],
    [`GET ${API_ROUTES.repo}`, async () => jsonResult(await getRepoOverview(git))],
    [`GET ${API_ROUTES.commit}`, async ({ url }) => jsonResult(await getCommitDetails(git, url.searchParams.get("hash") ?? ""))],
    [`GET ${API_ROUTES.help}`, async () => jsonResult(await buildHelpData(commands, readConfig))],
    [`GET ${API_ROUTES.config}`, async () => jsonResult(await configController.read())],
    [`POST ${API_ROUTES.config}`, async ({ body }) => jsonResult(await configController.save(body))],
  ]);
}

async function handleRequest(routes: Map<string, Route>, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const result = await resolveRequest(routes, request);
  response.writeHead(result.status, {
    "content-type": result.contentType,
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  response.end(result.body);
}

async function resolveRequest(routes: Map<string, Route>, request: IncomingMessage): Promise<RouteResult> {
  if (!isLocalHostHeader(request.headers.host)) return textResult(HTTP_FORBIDDEN, t("server.hostRefused"));
  const method = request.method ?? "";
  if (!ALLOWED_METHODS.includes(method)) return textResult(HTTP_METHOD_NOT_ALLOWED, t("server.methodRefused"));
  const url = new URL(request.url ?? "/", "http://localhost");
  const route = routes.get(`${method} ${url.pathname}`);
  if (!route) return textResult(HTTP_NOT_FOUND, "Page introuvable");
  try {
    const body = method === "POST" ? await readWriteRequestBody(request) : undefined;
    return await route({ url, body });
  } catch (error) {
    return errorResult(error);
  }
}

function errorResult(error: unknown): RouteResult {
  if (error instanceof RequestError) return jsonResult({ error: error.message }, error.status);
  if (error instanceof ConfigError) return jsonResult({ error: error.message, issues: error.issues }, HTTP_UNPROCESSABLE_CONTENT);
  return jsonResult({ error: messageOf(error) }, HTTP_INTERNAL_ERROR);
}

/**
 * Bloque le CSRF : un site tiers peut envoyer un formulaire vers localhost, mais ni un en-tête Origin local
 * ni un corps JSON sans passer par un preflight CORS que ce serveur ne valide jamais.
 */
async function readWriteRequestBody(request: IncomingMessage): Promise<unknown> {
  if (!isSameOrigin(request)) throw new RequestError(HTTP_FORBIDDEN, t("server.originRefused"));
  const contentType = request.headers["content-type"] ?? "";
  if (contentType.split(";")[0]?.trim() !== JSON_MEDIA_TYPE) {
    throw new RequestError(HTTP_UNSUPPORTED_MEDIA_TYPE, t("server.jsonRequired"));
  }
  return parseJsonBody(await readBody(request));
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return false;
  try {
    const parsed = new URL(origin);
    return ALLOWED_HOSTNAMES.includes(parsed.hostname) && parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let sizeInBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    sizeInBytes += buffer.length;
    if (sizeInBytes > MAX_REQUEST_BODY_BYTES) throw new RequestError(HTTP_PAYLOAD_TOO_LARGE, t("server.bodyTooLarge"));
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJsonBody(text: string): unknown {
  const parsed = tryParseJson(text);
  if (!parsed.ok) throw new RequestError(HTTP_BAD_REQUEST, t("server.invalidJson"));
  return parsed.value;
}

/** Bloque le DNS rebinding : un site tiers ne peut pas lire l'historique via un domaine pointant sur 127.0.0.1. */
function isLocalHostHeader(host: string | undefined): boolean {
  return ALLOWED_HOSTNAMES.includes((host ?? "").split(":")[0] ?? "");
}

async function servePage(fileName: string): Promise<RouteResult> {
  const body = translatePage(await readFile(new URL(`../web/pages/${fileName}`, import.meta.url), "utf8"));
  return { status: HTTP_OK, contentType: HTML_CONTENT_TYPE, body };
}

function jsonResult(data: unknown, status: number = HTTP_OK): RouteResult {
  return { status, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(data) };
}

function textResult(status: number, body: string): RouteResult {
  return { status, contentType: TEXT_CONTENT_TYPE, body };
}

export function parseLogQuery(url: URL): LogQuery {
  const page = Number(url.searchParams.get("page") ?? "0");
  const field = SEARCH_FIELDS.find((candidate) => candidate === url.searchParams.get("field")) ?? "message";
  return {
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    search: url.searchParams.get("search")?.trim() ?? "",
    field,
    branch: url.searchParams.get("branch") ?? "",
  };
}

async function buildHelpData(commands: readonly Command[], readConfig: () => Promise<Config>): Promise<object> {
  return {
    commands: commands.map(({ name, aliases, usage, description, examples, gitSteps }) => ({
      name,
      aliases: aliases ?? [],
      usage,
      description,
      examples,
      gitSteps,
    })),
    configOptions: describeConfigOptions(),
    effectiveConfig: await readEffectiveConfig(readConfig),
  };
}

async function readEffectiveConfig(readConfig: () => Promise<Config>): Promise<Config | null> {
  try {
    return redactApiKeys(await readConfig());
  } catch {
    return null;
  }
}

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { HTTP_FORBIDDEN, HTTP_METHOD_NOT_ALLOWED, HTTP_NOT_FOUND } from "../constants/http.js";
import { API_ROUTES, ASSETS_ROUTE_PREFIX, PAGE_ROUTES } from "../constants/routes.js";
import type { WebServer } from "../contracts/command.js";
import { GitCommitError, hasErrorCode } from "../core/errors.js";
import { t } from "../lang/index.js";
import type { ConfigController } from "./controllers/config.js";
import type { HelpController } from "./controllers/help.js";
import type { LogController } from "./controllers/log.js";
import { ASSET_FILES, serveAsset } from "./http/assets.js";
import { readJsonBody } from "./http/body.js";
import { isLocalHostHeader, LOOPBACK_ADDRESS } from "./http/guards.js";
import { renderPage } from "./http/render.js";
import { errorResult, jsonResult, textResult } from "./http/response.js";
import type { Route, RouteResult } from "./http/route.js";

const PORT_ATTEMPTS = 10;
const ALLOWED_METHODS = ["GET", "POST"];
/** Aucun style ni script inline : tout vient de /assets, servi par ce serveur. */
const CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'";

export type WebControllers = {
  config: ConfigController;
  log: LogController;
  help: HelpController;
};

export type WebServerDependencies = {
  controllers: WebControllers;
  /** Lu au démarrage seulement : `web.port` est le premier port essayé. */
  readPort: () => Promise<number>;
};

export function createWebServer(dependencies: WebServerDependencies): WebServer {
  let startedUrl: string | undefined;
  return {
    async ensureStarted() {
      startedUrl ??= await start(dependencies);
      return startedUrl;
    },
  };
}

async function start({ controllers, readPort }: WebServerDependencies): Promise<string> {
  const routes = createRoutes(controllers);
  const server = createServer((request, response) => void handleRequest(routes, request, response));
  const port = await listenOnFirstFreePort(server, await readPort(), PORT_ATTEMPTS);
  server.unref();
  return `http://localhost:${port}`;
}

/** Une ligne par route : la page ou l'API, et le controller qui y répond. */
function createRoutes({ config, log, help }: WebControllers): Map<string, Route> {
  return new Map<string, Route>([
    [`GET ${PAGE_ROUTES.home}`, () => renderPage("log")],
    [`GET ${PAGE_ROUTES.log}`, () => renderPage("log")],
    [`GET ${PAGE_ROUTES.help}`, () => renderPage("help")],
    [`GET ${PAGE_ROUTES.config}`, () => renderPage("config")],
    [`GET ${API_ROUTES.log}`, async ({ url }) => jsonResult(await log.readPage(url))],
    [`GET ${API_ROUTES.repo}`, async () => jsonResult(await log.readOverview())],
    [`GET ${API_ROUTES.commit}`, async ({ url }) => jsonResult(await log.readCommit(url))],
    [`GET ${API_ROUTES.help}`, async () => jsonResult(await help.read())],
    [`GET ${API_ROUTES.config}`, async () => jsonResult(await config.read())],
    [`POST ${API_ROUTES.config}`, async ({ body }) => jsonResult(await config.save(body))],
    ...Object.entries(ASSET_FILES).map(([fileName, contentType]): [string, Route] => [
      `GET ${ASSETS_ROUTE_PREFIX}${fileName}`,
      () => serveAsset(fileName, contentType),
    ]),
  ]);
}

/** Deux git-commit ouverts sur deux dépôts doivent chacun servir le leur. */
async function listenOnFirstFreePort(server: Server, port: number, attemptsLeft: number): Promise<number> {
  if (attemptsLeft === 0) throw new GitCommitError(t("server.noPort", { port: port - PORT_ATTEMPTS }));
  try {
    await listen(server, port);
    return port;
  } catch (error) {
    if (hasErrorCode(error, "EADDRINUSE")) return listenOnFirstFreePort(server, port + 1, attemptsLeft - 1);
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
  if (!route) return textResult(HTTP_NOT_FOUND, t("server.notFound"));
  try {
    const body = method === "POST" ? await readJsonBody(request) : undefined;
    return await route({ url, body });
  } catch (error) {
    return errorResult(error);
  }
}

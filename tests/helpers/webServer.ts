import { request } from "node:http";
import type { Command, ConfigPaths } from "../../src/commands/types.js";
import { DEFAULT_CONFIG, type Config } from "../../src/core/config/schema.js";
import { createGitClient } from "../../src/core/git/gitClient.js";
import { createWebServer } from "../../src/web/server.js";

const FIRST_TEST_PORT = 41000;
const PORT_RANGE = 2000;

export type Reply = { status: number; headers: Record<string, string | string[] | undefined>; body: string };
export type SendOptions = { method?: string; headers?: Record<string, string>; body?: string };

export type TestServer = {
  baseUrl: URL;
  send(path: string, options?: SendOptions): Promise<Reply>;
  sameOriginJson(): Record<string, string>;
};

export type TestServerOptions = { cwd: string; paths: ConfigPaths; commands?: readonly Command[] };

/** Un port aléatoire par fichier de test : deux suites lancées en parallèle ne se gênent pas. */
export async function startTestServer({ cwd, paths, commands = [] }: TestServerOptions): Promise<TestServer> {
  const port = FIRST_TEST_PORT + Math.floor(Math.random() * PORT_RANGE);
  const config: Config = { ...DEFAULT_CONFIG, web: { port } };
  const server = createWebServer({
    git: createGitClient({ cwd }),
    commands,
    readConfig: () => Promise.resolve(config),
    readPaths: () => Promise.resolve(paths),
  });
  const baseUrl = new URL(await server.ensureStarted());
  return {
    baseUrl,
    send: (path, options) => send(baseUrl, path, options),
    sameOriginJson: () => ({ origin: baseUrl.origin, "content-type": "application/json" }),
  };
}

function send(baseUrl: URL, path: string, { method = "GET", headers = {}, body }: SendOptions = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const outgoing = request(new URL(path, baseUrl), { method, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () =>
        resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

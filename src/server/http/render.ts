import { readFile } from "node:fs/promises";
import { translatePage } from "../../lang/index.js";
import { htmlResult } from "./response.js";
import type { RouteResult } from "./route.js";

export type PageView = "log" | "help" | "config";

/** Les vues vivent dans src/web (copiées dans dist/web au build) : le serveur ne les lit que comme fichiers. */
const VIEWS_DIRECTORY = new URL("../../web/pages/", import.meta.url);

export async function renderPage(view: PageView): Promise<RouteResult> {
  const html = await readFile(new URL(`${view}.html`, VIEWS_DIRECTORY), "utf8");
  return htmlResult(translatePage(html));
}

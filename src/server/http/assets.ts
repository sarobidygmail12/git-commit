import { readFile } from "node:fs/promises";
import { HTTP_OK } from "../../constants/http.js";
import { WEB_ROOT } from "./render.js";
import type { RouteResult } from "./route.js";

const CSS_CONTENT_TYPE = "text/css; charset=utf-8";
const JAVASCRIPT_CONTENT_TYPE = "text/javascript; charset=utf-8";

/** Liste blanche : aucun chemin venant de l'URL n'est lu sur le disque. `app.css` est produit par Tailwind au build. */
export const ASSET_FILES: Readonly<Record<string, string>> = {
  "app.css": CSS_CONTENT_TYPE,
  "app.js": JAVASCRIPT_CONTENT_TYPE,
  "log.js": JAVASCRIPT_CONTENT_TYPE,
  "help.js": JAVASCRIPT_CONTENT_TYPE,
  "config.js": JAVASCRIPT_CONTENT_TYPE,
};

export async function serveAsset(fileName: string, contentType: string): Promise<RouteResult> {
  const body = await readFile(new URL(`assets/${fileName}`, WEB_ROOT), "utf8");
  return { status: HTTP_OK, contentType, body };
}

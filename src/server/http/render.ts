import { readFile } from "node:fs/promises";
import { translatePage, webMessages, type MessageKey } from "../../lang/index.js";
import { htmlResult } from "./response.js";
import type { RouteResult } from "./route.js";

export type PageView = "log" | "help" | "config";

type ViewSettings = { titleKey: MessageKey; bodyClass: string };

/** Classes Tailwind du <body> : pages de lecture (texte confortable) et log (dense, plein écran, focus à l'intérieur des lignes). */
const DOCUMENT_BODY_CLASS = "m-0 bg-bg font-sans text-body leading-body text-text";
const LOG_BODY_CLASS =
  "m-0 flex h-screen flex-col overflow-hidden bg-bg font-sans text-footnote leading-dense text-text **:focus-visible:-outline-offset-2";

const VIEW_SETTINGS: Record<PageView, ViewSettings> = {
  log: { titleKey: "web.graphTitle", bodyClass: LOG_BODY_CLASS },
  help: { titleKey: "web.helpTitle", bodyClass: DOCUMENT_BODY_CLASS },
  config: { titleKey: "web.configTitle", bodyClass: DOCUMENT_BODY_CLASS },
};

/** Le front vit dans src/web (copié dans dist/web au build) : le serveur ne le lit que comme fichiers. */
export const WEB_ROOT = new URL("../../web/", import.meta.url);
/**
 * Inclusion d'un fichier de templates/ dans une vue. Accepte : `{{> header}}`. Ignore : `{{web.theme}}`, `{{>header}}`.
 * https://regex101.com/?regex=%5C%7B%5C%7B%3E%20(%5Cw%2B)%5C%7D%5C%7D&testString=%3Cmain%3E%7B%7B%3E%20header%7D%7D%3C%2Fmain%3E
 */
const PARTIAL_PATTERN = /\{\{> (\w+)\}\}/g;
/**
 * Emplacement du layout. Accepte : `{{content}}`, `{{title}}`. Ignore : `{{web.theme}}` (traduit ensuite), `{{> header}}`.
 * https://regex101.com/?regex=%5C%7B%5C%7B(%5Cw%2B)%5C%7D%5C%7D&testString=%3Ctitle%3E%7B%7Btitle%7D%7D%3C%2Ftitle%3E%7B%7Bweb.theme%7D%7D
 */
const SLOT_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Assemble `templates/layout.html` et `views/<vue>.html`, résout les `{{> partial}}`, puis traduit les `{{web.*}}`.
 * Les textes des scripts sont injectés en JSON (<script type="application/json">), que la CSP n'exécute pas.
 */
export async function renderPage(view: PageView): Promise<RouteResult> {
  const settings = VIEW_SETTINGS[view];
  const [layout, content] = await Promise.all([readWebFile("templates/layout.html"), readWebFile(`views/${view}.html`)]);
  const page = fillSlots(layout, {
    title: `{{${settings.titleKey}}}`,
    view,
    bodyClass: settings.bodyClass,
    messages: serializeForScript(webMessages()),
    content: await resolvePartials(content),
  });
  return htmlResult(translatePage(page));
}

function readWebFile(path: string): Promise<string> {
  return readFile(new URL(path, WEB_ROOT), "utf8");
}

async function resolvePartials(html: string): Promise<string> {
  const names = [...new Set([...html.matchAll(PARTIAL_PATTERN)].map(([, name = ""]) => name))];
  const partials = new Map(await Promise.all(names.map(async (name) => [name, await readWebFile(`templates/${name}.html`)] as const)));
  return html.replace(PARTIAL_PATTERN, (_match, name: string) => partials.get(name) ?? "");
}

/** Remplace chaque `{{slot}}` en une seule passe : un texte injecté ne peut pas lui-même être pris pour un slot. */
function fillSlots(template: string, slots: Readonly<Record<string, string>>): string {
  return template.replace(SLOT_PATTERN, (match, name: string) => slots[name] ?? match);
}

/** `</script>` dans un texte traduit fermerait le bloc JSON : `<` est donc échappé. */
function serializeForScript(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

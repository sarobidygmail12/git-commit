import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Règles d'architecture décrites dans CLAUDE.md. Chaque violation connue est listée dans KNOWN_VIOLATIONS :
 * une nouvelle violation fait échouer le test, et une exception qui ne s'applique plus aussi (la liste ne fait que rétrécir).
 */

const SOURCE_ROOT = resolve("src");
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
/**
 * Capture la cible d'un import statique, dynamique ou d'effet de bord.
 * Accepte : `from "../core/errors.js"`, `import("./x.js")`, `import "./setup.js"`. Ignore : `const from = "x"`.
 * https://regex101.com/?regex=(%3F%3Afrom%5Cs%2B%7Cimport%5Cs*%5C(%5Cs*%7Cimport%5Cs%2B)%5B%22'%5D(%5B%5E%22'%5D%2B)%5B%22'%5D&testString=import%20%7B%20t%20%7D%20from%20%22..%2Flang%2Findex.js%22%3B
 */
const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

type SourceFile = { path: string; text: string; imports: string[] };
type Rule = { name: string; check: (file: SourceFile) => boolean };

const KNOWN_VIOLATIONS: readonly string[] = [];

const isUnder = (path: string, ...folders: string[]): boolean => folders.some((folder) => path.startsWith(`${folder}/`) || path === folder);
const importsFrom = (file: SourceFile, ...folders: string[]): boolean => file.imports.some((target) => isUnder(target, ...folders));

const RULES: readonly Rule[] = [
  {
    name: "core n'importe ni server, ni commands, ni ui, ni web",
    check: (file) => isUnder(file.path, "core") && importsFrom(file, "server", "commands", "ui", "web"),
  },
  {
    name: "commands n'appelle pas git directement (ctx.git.run, execa)",
    check: (file) => isUnder(file.path, "commands") && (file.text.includes(".git.run(") || file.imports.includes("execa")),
  },
  {
    name: "ui n'importe ni commands ni server",
    check: (file) => isUnder(file.path, "ui") && importsFrom(file, "commands", "server"),
  },
  {
    name: "server/services n'importe ni controllers, ni http, ni commands, ni ui",
    check: (file) =>
      isUnder(file.path, "server/services") && importsFrom(file, "server/controllers", "server/http", "commands", "ui"),
  },
  {
    name: "contracts et constants n'importent que des types de core",
    check: (file) => isUnder(file.path, "contracts", "constants") && hasNonTypeInternalImport(file),
  },
  {
    name: "src/web ne contient pas de TypeScript",
    check: (file) => isUnder(file.path, "web"),
  },
  {
    name: "process.env n'est lu que par le point d'entrée, qui le passe au container",
    check: (file) => file.path !== "index.ts" && file.text.includes("process.env"),
  },
];

/** `import type` est toléré : un contrat peut décrire un type de core sans en dépendre à l'exécution. */
function hasNonTypeInternalImport(file: SourceFile): boolean {
  return file.text
    .split("\n")
    .filter((line) => line.startsWith("import ") && !line.startsWith("import type "))
    .some((line) => line.includes('"../') || line.includes('"./'));
}

function listed(title: string, violations: readonly string[]): string {
  return violations.map((violation) => `${title} : ${violation}`).join("\n");
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

function readSourceFile(absolutePath: string): SourceFile {
  const text = readFileSync(absolutePath, "utf8");
  const imports = [...text.matchAll(IMPORT_PATTERN)].map(([, specifier = ""]) => toSourcePath(absolutePath, specifier));
  return { path: relative(SOURCE_ROOT, absolutePath), text, imports };
}

/** Un import relatif devient un chemin depuis src/ (`../core/git/status.js` → `core/git/status.js`) ; un paquet reste tel quel. */
function toSourcePath(fromFile: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  return relative(SOURCE_ROOT, resolve(dirname(fromFile), specifier));
}

function findViolations(): string[] {
  const files = listSourceFiles(SOURCE_ROOT).map(readSourceFile);
  return files.flatMap((file) => RULES.filter((rule) => rule.check(file)).map((rule) => `${file.path} — ${rule.name}`)).sort();
}

describe("architecture", () => {
  const violations = findViolations();

  it("n'introduit aucune nouvelle violation", () => {
    const added = violations.filter((violation) => !KNOWN_VIOLATIONS.includes(violation));
    expect(added, listed("Nouvelle violation (voir CLAUDE.md pour la bonne couche)", added)).toEqual([]);
  });

  it("retire de la liste les exceptions corrigées", () => {
    const fixed = KNOWN_VIOLATIONS.filter((violation) => !violations.includes(violation));
    expect(fixed, listed("Exception corrigée, à retirer de KNOWN_VIOLATIONS", fixed)).toEqual([]);
  });

  it("regroupe les fichiers dans des couches connues", () => {
    const layers = new Set(listSourceFiles(SOURCE_ROOT).map((path) => relative(SOURCE_ROOT, path).split("/")[0]));
    expect([...layers].sort()).toEqual(expect.arrayContaining(["commands", "core", "lang", "ui"]));
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LOG_SCRIPT = "src/web/assets/log.js";
const CLASSES_START = "const CLASSES = {";
const CLASSES_END = "\n};";
const SINGLE_LINE_CLASSES = ["whitespace-nowrap", "truncate"];

const ENTRY_SEPARATOR = ': "';
const ENTRY_END = '",';

/** Lit les lignes `clé: "classes",` de la constante CLASSES d'un script de vue, sans exécuter le fichier. */
function readViewClasses(path: string): Record<string, string> {
  const source = readFileSync(path, "utf8");
  const start = source.indexOf(CLASSES_START);
  const end = source.indexOf(CLASSES_END, start);
  if (start === -1 || end === -1) throw new Error(`CLASSES introuvable dans ${path}`);
  const entries = source
    .slice(start + CLASSES_START.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(ENTRY_SEPARATOR) && line.endsWith(ENTRY_END))
    .map((line): [string, string] => {
      const separator = line.indexOf(ENTRY_SEPARATOR);
      return [line.slice(0, separator), line.slice(separator + ENTRY_SEPARATOR.length, -ENTRY_END.length)];
    });
  return Object.fromEntries(entries);
}

const staysOnOneLine = (className: string): boolean =>
  className.split(" ").some((token) => SINGLE_LINE_CLASSES.includes(token));

describe("vue /log : noms longs", () => {
  const classes = readViewClasses(LOG_SCRIPT);

  it.each(["refsCell", "cell", "authorCell", "pill", "label"])(
    "%s reste sur une ligne : un nom long est coupé par « … » au lieu de passer à la ligne et de disparaître",
    (key) => {
      expect(classes[key], `CLASSES.${key} manquante dans ${LOG_SCRIPT}`).toBeDefined();
      expect(staysOnOneLine(classes[key] ?? ""), `CLASSES.${key} = "${classes[key] ?? ""}"`).toBe(true);
    },
  );
});

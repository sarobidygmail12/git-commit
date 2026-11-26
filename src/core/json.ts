import { messageOf } from "./errors.js";

export type JsonParseResult = { ok: true; value: unknown } | { ok: false; reason: string };

/** Chaque appelant décide quoi faire d'un JSON invalide : erreur de config, 400, ou texte brut. */
export function tryParseJson(text: string): JsonParseResult {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: messageOf(error) };
  }
}

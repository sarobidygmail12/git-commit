import type { IncomingMessage } from "node:http";
import { HTTP_FORBIDDEN, HTTP_UNSUPPORTED_MEDIA_TYPE, JSON_MEDIA_TYPE } from "../../constants/http.js";
import { t } from "../../lang/index.js";
import { RequestError } from "./requestError.js";

export const LOOPBACK_ADDRESS = "127.0.0.1";
const ALLOWED_HOSTNAMES = ["localhost", LOOPBACK_ADDRESS];

/** Bloque le DNS rebinding : un site tiers ne peut pas lire l'historique via un domaine pointant sur 127.0.0.1. */
export function isLocalHostHeader(host: string | undefined): boolean {
  return ALLOWED_HOSTNAMES.includes((host ?? "").split(":")[0] ?? "");
}

/**
 * Bloque le CSRF : un site tiers peut envoyer un formulaire vers localhost, mais ni un en-tête Origin local
 * ni un corps JSON sans passer par un preflight CORS que ce serveur ne valide jamais.
 */
export function assertJsonWriteRequest(request: IncomingMessage): void {
  if (!isSameOrigin(request)) throw new RequestError(HTTP_FORBIDDEN, t("server.originRefused"));
  const contentType = request.headers["content-type"] ?? "";
  if (contentType.split(";")[0]?.trim() !== JSON_MEDIA_TYPE) {
    throw new RequestError(HTTP_UNSUPPORTED_MEDIA_TYPE, t("server.jsonRequired"));
  }
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

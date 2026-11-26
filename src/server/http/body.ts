import type { IncomingMessage } from "node:http";
import { HTTP_BAD_REQUEST, HTTP_PAYLOAD_TOO_LARGE, MAX_REQUEST_BODY_BYTES } from "../../constants/http.js";
import { tryParseJson } from "../../core/json.js";
import { t } from "../../lang/index.js";
import { assertJsonWriteRequest } from "./guards.js";
import { RequestError } from "./requestError.js";

/** Corps d'une requête d'écriture : contrôlé (origine, type), borné en taille, puis lu comme JSON. */
export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  assertJsonWriteRequest(request);
  const parsed = tryParseJson(await readBody(request));
  if (!parsed.ok) throw new RequestError(HTTP_BAD_REQUEST, t("server.invalidJson"));
  return parsed.value;
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

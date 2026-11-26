import {
  HTML_CONTENT_TYPE,
  HTTP_INTERNAL_ERROR,
  HTTP_OK,
  HTTP_UNPROCESSABLE_CONTENT,
  JSON_CONTENT_TYPE,
  TEXT_CONTENT_TYPE,
} from "../../constants/http.js";
import { ConfigError, messageOf } from "../../core/errors.js";
import { RequestError } from "./requestError.js";
import type { RouteResult } from "./route.js";

export function jsonResult(data: unknown, status: number = HTTP_OK): RouteResult {
  return { status, contentType: JSON_CONTENT_TYPE, body: JSON.stringify(data) };
}

export function textResult(status: number, body: string): RouteResult {
  return { status, contentType: TEXT_CONTENT_TYPE, body };
}

export function htmlResult(body: string): RouteResult {
  return { status: HTTP_OK, contentType: HTML_CONTENT_TYPE, body };
}

/** Format d'erreur unique de l'API : `{ error }`, plus `issues` pour une configuration refusée. */
export function errorResult(error: unknown): RouteResult {
  if (error instanceof RequestError) return jsonResult({ error: error.message }, error.status);
  if (error instanceof ConfigError) return jsonResult({ error: error.message, issues: error.issues }, HTTP_UNPROCESSABLE_CONTENT);
  return jsonResult({ error: messageOf(error) }, HTTP_INTERNAL_ERROR);
}

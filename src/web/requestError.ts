import { GitPushError } from "../core/errors.js";

export const HTTP_BAD_REQUEST = 400;
export const HTTP_FORBIDDEN = 403;
export const HTTP_PAYLOAD_TOO_LARGE = 413;
export const HTTP_UNSUPPORTED_MEDIA_TYPE = 415;

/** Une requête refusée avant tout traitement : le serveur la renvoie avec son statut, jamais en 500. */
export class RequestError extends GitPushError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

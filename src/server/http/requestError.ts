import { GitPushError } from "../../core/errors.js";

/** Une requête refusée avant tout traitement : le serveur la renvoie avec son statut, jamais en 500. */
export class RequestError extends GitPushError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

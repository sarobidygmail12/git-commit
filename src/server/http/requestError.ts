import { GitCommitError } from "../../core/errors.js";

/** Une requête refusée avant tout traitement : le serveur la renvoie avec son statut, jamais en 500. */
export class RequestError extends GitCommitError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

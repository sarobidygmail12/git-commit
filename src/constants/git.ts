/** Le remote que git-commit crée, pousse et lit : un seul nom pour toutes les commandes. */
export const DEFAULT_REMOTE = "origin";

export const LOCAL_PREFIX = "refs/heads/";
export const REMOTE_PREFIX = "refs/remotes/";
export const TAGS_PREFIX = "refs/tags/";

/** Longueur du hash court affiché (en-tête, branches de sauvegarde), comme `git rev-parse --short`. */
export const SHORT_HASH_LENGTH = 7;

/** Le fichier global peut contenir une clé API : lisible par son seul propriétaire. */
export const OWNER_ONLY_FILE_MODE = 0o600;
export const OWNER_ONLY_DIRECTORY_MODE = 0o700;
/** `.git-push.json` est versionné avec le dépôt : lisible par tous, comme les autres fichiers du projet. */
export const SHARED_FILE_MODE = 0o644;

/** Clés qui pollueraient le prototype si un fichier JSON ou un chemin `a.b.c` les utilisait. */
export const UNSAFE_OBJECT_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

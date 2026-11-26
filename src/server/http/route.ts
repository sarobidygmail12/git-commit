export type RouteResult = { status: number; contentType: string; body: string };

export type RouteRequest = { url: URL; body: unknown };

/** Clé `"<méthode> <chemin>"` : une route d'écriture n'est jamais atteinte en GET, ni l'inverse. */
export type Route = (request: RouteRequest) => Promise<RouteResult>;

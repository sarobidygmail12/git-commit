/** Pages servies par le serveur local et ouvertes par /log, /help et /config. */
export const PAGE_ROUTES = {
  home: "/",
  log: "/log",
  help: "/help",
  config: "/config",
} as const;

export const API_ROUTES = {
  log: "/api/log",
  repo: "/api/repo",
  commit: "/api/commit",
  commitFile: "/api/commit/file",
  help: "/api/help",
  config: "/api/config",
} as const;

/** Feuille de style et scripts des pages, servis depuis web/assets. */
export const ASSETS_ROUTE_PREFIX = "/assets/";

"use strict";
/* Helpers partagés par toutes les vues : textes traduits, thème, DOM et appels à l'API locale. */

const THEME_STORAGE_KEY = "git-commit-theme";
let cachedMessages = null;

/** Texte traduit `web.<key>`, injecté par le serveur dans <script id="messages">. `{name}` est remplacé par params.name. */
function message(key, params = {}) {
  cachedMessages ??= JSON.parse(document.getElementById("messages").textContent);
  const text = cachedMessages[key] ?? key;
  return Object.entries(params).reduce((result, [name, value]) => result.replaceAll("{" + name + "}", String(value)), text);
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** Erreur de l'API avec ses `issues` (configuration refusée), pour les afficher sous les bons champs. */
async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    const failure = new Error(payload.error);
    failure.issues = Array.isArray(payload.issues) ? payload.issues : [];
    throw failure;
  }
  return payload;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

function savedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/* Appliqué dans <head>, avant le premier rendu : la page ne clignote pas en clair avant de passer en sombre. */
applyTheme(savedTheme() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("theme")?.addEventListener("click", () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"),
  );
});

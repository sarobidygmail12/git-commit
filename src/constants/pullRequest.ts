/** Emoji ajouté au titre d'une pull request selon son type (conventional commits), sur le modèle de gitmoji. */
export const PULL_REQUEST_EMOJI_BY_TYPE: Readonly<Record<string, string>> = {
  feat: "✨",
  fix: "🚒",
  hotfix: "🚑️",
  docs: "📝",
  style: "🎨",
  refactor: "♻️",
  perf: "⚡️",
  test: "✅",
  build: "📦️",
  ci: "👷",
  chore: "🔧",
  revert: "⏪️",
};

/** Titre sans type reconnu, ni dans le titre ni dans le préfixe de la branche. */
export const DEFAULT_PULL_REQUEST_EMOJI = "🚀";

/**
 * Mots qui signalent la correction d'un bug dans un titre sans type, en anglais et en français, sans accents :
 * « Corrige le panier », « Résout le crash », « Fix login » reçoivent alors 🚒.
 */
export const BUG_TITLE_KEYWORDS: ReadonlySet<string> = new Set([
  "bug",
  "bugs",
  "bugfix",
  "fix",
  "fixes",
  "fixed",
  "fixing",
  "resolve",
  "resolves",
  "resolved",
  "repair",
  "repairs",
  "corrige",
  "corriger",
  "correction",
  "corrections",
  "resout",
  "resoudre",
  "resolu",
  "resolue",
  "repare",
  "reparer",
]);

export const BUG_FIX_TYPE = "fix";

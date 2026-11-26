import {
  BUG_FIX_TYPE,
  BUG_TITLE_KEYWORDS,
  DEFAULT_PULL_REQUEST_EMOJI,
  PULL_REQUEST_EMOJI_BY_TYPE,
} from "../../constants/pullRequest.js";

/**
 * Type conventional commit en tête du titre. Accepte : `feat: panier`, `fix(api)!: crash` (→ feat, fix).
 * Ignore : `Ajoute le panier`, `feat panier`.
 * https://regex101.com/?regex=%5E(%5Ba-z%5D%2B)(%3F%3A%5C(%5B%5E)%5D*%5C))%3F!%3F%3A&testString=fix(api)!%3A%20crash
 */
const CONVENTIONAL_TYPE_PATTERN = /^([a-z]+)(?:\([^)]*\))?!?:/;
/**
 * Titre qui commence déjà par un emoji. Accepte : `✨ feat: panier`, `🚀 Release`. Ignore : `feat: ✨ panier`.
 * https://regex101.com/?regex=%5E%5Cp%7BExtended_Pictographic%7D&flags=u&testString=%F0%9F%9A%80%20Release
 */
const LEADING_EMOJI_PATTERN = /^\p{Extended_Pictographic}/u;
const BRANCH_PREFIX_SEPARATOR = "/";
/**
 * Accents retirés après la décomposition NFD. Accepte le `́` de `é` décomposé. Ignore les lettres elles-mêmes.
 * https://regex101.com/?regex=%5Cp%7BDiacritic%7D&flags=gu&testString=re%CC%81sout
 */
const DIACRITIC_PATTERN = /\p{Diacritic}/gu;
/**
 * Séparateurs entre les mots d'un titre. Coupe sur espaces, ponctuation, `:` et `/`. Garde lettres et chiffres ensemble.
 * https://regex101.com/?regex=%5B%5E%5Cp%7BL%7D%5Cp%7BN%7D%5D%2B&flags=u&testString=Corrige%20le%20panier%2C%20bug%20%2312
 */
const WORD_SEPARATOR_PATTERN = /[^\p{L}\p{N}]+/u;

/**
 * Chaque pull request porte un emoji en tête de titre : celui du type du titre, sinon du préfixe de la branche
 * (`hotfix/…`), sinon 🚒 si le titre parle d'un bug (« Corrige… », « Résout… »), sinon 🚀. Un titre qui commence déjà par un emoji est laissé tel quel : appliquer deux fois ne change rien.
 */
export function withTitleEmoji(title: string, branch: string): string {
  const trimmed = title.trim();
  if (trimmed === "" || LEADING_EMOJI_PATTERN.test(trimmed)) return trimmed;
  return `${chooseEmoji(trimmed, branch)} ${trimmed}`;
}

function chooseEmoji(title: string, branch: string): string {
  const titleType = CONVENTIONAL_TYPE_PATTERN.exec(title)?.[1];
  const branchType = branch.includes(BRANCH_PREFIX_SEPARATOR) ? branch.split(BRANCH_PREFIX_SEPARATOR)[0] : undefined;
  const bugType = mentionsBug(title) ? BUG_FIX_TYPE : undefined;
  return emojiOf(titleType) ?? emojiOf(branchType) ?? emojiOf(bugType) ?? DEFAULT_PULL_REQUEST_EMOJI;
}

function emojiOf(type: string | undefined): string | undefined {
  return type === undefined ? undefined : PULL_REQUEST_EMOJI_BY_TYPE[type];
}

/** Mots entiers seulement, sans casse ni accents : « Résout » compte, « Debugger » ne compte pas. */
function mentionsBug(title: string): boolean {
  const words = title.normalize("NFD").replace(DIACRITIC_PATTERN, "").toLowerCase().split(WORD_SEPARATOR_PATTERN);
  return words.some((word) => BUG_TITLE_KEYWORDS.has(word));
}

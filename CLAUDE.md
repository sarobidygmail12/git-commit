# git-commit.dev — architecture et règles du projet

Ce fichier complète le CLAUDE.md global. En cas de conflit, ce fichier l'emporte pour ce projet.

## Couches

```
src/
  server/       TOUT le backend
    container.ts  seul endroit qui câble les dépendances (git, config, IA, serveur web, session)
    session.ts    boucle REPL ; reçoit tout du container
    server.ts     serveur HTTP : écoute + table de routes, rien d'autre
    http/         guards (Host, Origin, JSON), body, response (+ erreurs), render (layout + vue), assets
    controllers/  lisent et valident la requête (zod), appellent un service, renvoient un DTO
    services/     règles métier et commandes git par domaine (branch, commit, sync, repo, config, log, help),
                  sans UI ni HTTP ; partagés par les commandes CLI et les controllers
  web/          TOUT le frontend, aucun TypeScript
    templates/    layout.html et partials (`{{> header}}`)
    views/        contenu de chaque page, en classes Tailwind ; aucun <style> ni <script> inline
    styles/       app.css seulement : thème Apple (tokens clair/sombre), base minimale, composants @utility
    assets/       app.js (message, element, requestJson, thème) et un script par vue
  commands/     commandes CLI : arguments, questions (ctx.ui), un service, affichage
  contracts/    types partagés (Command, CommandContext, ReplSession…)
  constants/    git.ts, http.ts, routes.ts, files.ts
  core/         accès bas niveau : git/, config/, ai/, errors.ts, json.ts
  ui/           terminal Ink
  lang/         en, fr, de, zh
```

Sens des imports :

- `commands → server/services → core` et `server/controllers → server/services → core`.
- `core` n'importe jamais `server`, `commands`, `ui` ni `web`.
- `ui` n'importe ni `commands` ni `server` : il passe par `contracts`.
- `server/services` n'importe ni `controllers`, ni `http`, ni `commands`, ni `ui`.
- `contracts` et `constants` n'importent que des types de `core`.
- `process.env` n'est lu que dans `index.ts`, qui le passe au container.
- `commands/` n'appelle jamais git directement (`ctx.git.run`, `execa`) : la règle va dans un service.

`tests/architecture.test.ts` vérifie ces règles et la liste `KNOWN_VIOLATIONS` est vide. N'y ajoute jamais d'entrée : déplace le code dans la bonne couche.

## Pour une feature, je touche ici

| Je veux… | Je touche |
|---|---|
| une commande CLI | `server/services/<domaine>.ts` (la règle) + `commands/<nom>.ts` + `commands/registry.ts` + clés `cmd.*` et messages dans les 4 `lang/*.json` + un test |
| une page web | `server/services/<domaine>.ts` + `server/controllers/<page>.ts` + routes dans `server/server.ts` + `constants/routes.ts` + `web/views/<page>.html` + `web/assets/<page>.js` (à ajouter dans `server/http/assets.ts` et `server/http/render.ts`) + lien dans le header ou la nav |
| une route d'API | `constants/routes.ts` + méthode du controller + service + test dans `tests/webServer.test.ts` |
| du style | des classes Tailwind dans la vue, ou dans la constante `CLASSES` du script de la vue pour les éléments créés en JS ; un état (sélectionné, actif…) est un attribut `data-*` + variante `data-*:`. Aucune feuille par page |
| un composant répété (bouton, champ, interrupteur…) | un `@utility` dans `web/styles/app.css`, construit avec `@apply` sur les tokens du thème |
| une couleur, un coin, une ombre, une taille de texte | un token dans `web/styles/app.css` (couleurs : clair **et** sombre, exposées dans `@theme inline`), puis la classe `bg-*`, `rounded-*`, `shadow-*`, `text-*` ; jamais de valeur en dur dans une classe |
| une dépendance à câbler | `server/container.ts` uniquement |
| une constante | `constants/<domaine>.ts` |
| une option de config | `core/config/schema.ts` + `option.*` dans les 4 langues |
| un texte affiché | une clé dans les 4 `lang/*.json` ; côté page : `{{web.clé}}` en HTML, `message("clé")` en JS |

## Conventions

- Factories `createX` pour ce qui a des dépendances (controllers, serveur, container). Fonctions libres avec les dépendances en premier argument (`git`, `config`, `paths`) pour core et services.
- Une commande ne lance jamais git : elle pose les questions et appelle le service ; le service lance git et applique la règle. Une étape interactive au milieu d'un flux se découpe en plusieurs appels de service.
- Une règle métier n'existe qu'à un endroit : branches protégées (`listProtectedBranches`), nom de branche (`assertValidBranchName`), fichiers sensibles (`findSensitivePaths`), branche divergée (`hasDiverged`).
- Argument manquant : `warnUsage(ctx, command)`.
- Une erreur HTTP de requête est une `RequestError(status, message)` levée par le controller. Les erreurs de configuration sont des `ConfigError` (422).
- Utilitaires partagés : `hasErrorCode`, `messageOf` (`core/errors.ts`), `tryParseJson` (`core/json.ts`), `loadConfigAt`, `resolveConfigTarget`.
- CSP stricte (`'self'` seulement) : aucun style ni script inline, aucun attribut `style=` ni `onclick=`.
- Commentaires en français, seulement pour le *pourquoi*.

## Design et animation

Les skills d'Emil Kowalski (`emilkowalski/skills`, commit `64eb3de`) sont installés dans `.claude/skills/`. Toute modification de `src/web/` les applique :

| Quand | Skill |
|---|---|
| Je construis ou modifie une page, un composant, un état (hover, press, focus) | `emil-design-eng`, `apple-design` |
| J'ajoute une animation ou une transition | `animate` (et `choreograph` si plusieurs éléments bougent ensemble) |
| Une animation saccade | `animation-performance` |
| Avant de livrer une vue | `/review-animations` sur le diff, `break-ui` avec des données extrêmes (noms de branche très longs, 0 commit, 5 000 commits, emoji, chinois) |
| Audit global du front | `/improve-animations` |

Règles non négociables, issues de ces skills :

- Courbes : uniquement les tokens `--ease-out`, `--ease-in-out`, `--ease-drawer` de `web/styles/app.css` (classes `ease-out`…). Jamais `ease-in` sur l'interface, jamais de courbe inventée.
- Durées : moins de 300 ms pour l'interface (appui 100-160 ms, popover 125-200 ms, menu 150-250 ms) ; la sortie est plus rapide que l'entrée.
- Propriétés : `transform` et `opacity` seulement, listées explicitement. Jamais `transition: all`, jamais `scale(0)` (partir de `scale(0.95)` + `opacity: 0`).
- Boutons : retour à l'appui (`active:scale-97` en Tailwind, `:active { transform: scale(0.97) }` dans une feuille de page).
- Rien d'animé sur une action clavier ou très fréquente (recherche, navigation dans l'historique).
- Survol animé seulement sous `@media (hover: hover) and (pointer: fine)` : la variante `hover:` de Tailwind v4 le fait déjà, une feuille de page doit l'écrire.
- `prefers-reduced-motion` respecté : animations réduites à un fondu ou supprimées.
- Les popovers s'ouvrent depuis leur déclencheur (`transform-origin`), les modales restent centrées.

## Commandes

- `yarn build` : tsc, puis Tailwind (`build:css`), puis copie de `src/web` vers `dist/web`. Relance git-commit ensuite.
- `yarn dev:css` : Tailwind en mode watch.
- `yarn typecheck`, `yarn test` (vitest compile le CSS avant les tests).

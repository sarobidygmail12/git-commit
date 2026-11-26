# 🧭 git-push

<img width="788" height="532" alt="demo-commit-switch-branch" src="https://github.com/user-attachments/assets/89b715bd-0392-4691-9678-a2fcc50fdbd2" />

[🇬🇧 English](README.md) | 🇫🇷 Français

**Git avec des commandes simples, directement dans ton terminal.** Tu tapes `/commit`, git-push lit tes modifications, écrit le message du commit et envoie ton travail sur GitHub. Tu débutes avec Git ? Cette page est pour toi. 👋

> [!NOTE]
> Les écrans sont en anglais par défaut. Tape `/lang fr` pour passer en français (ou en chinois, en allemand). Les commandes restent les mêmes dans toutes les langues.

## 🎯 Ce que ça résout

| Problème | Avec git-push |
| --- | --- |
| Les commandes Git sont difficiles à retenir | Une commande courte par tâche : `/commit`, `/pull`, `/switch`… avec l'autocomplétion |
| Écrire un bon message de commit prend du temps | L'IA lit tes modifications et écrit le message pour toi |
| Peur de casser ou de perdre son travail | Les commandes dangereuses sont bloquées, les branches protégées et les fichiers secrets demandent d'abord |
| Les conflits font peur | Un écran guidé : continuer, passer ou tout annuler |
| L'historique est difficile à lire | Un graphe clair dans ton navigateur avec `/log` |
| Les réglages sont dans des fichiers JSON | Une page de réglages dans ton navigateur avec `/config` |

## 📥 Installer

Il te faut [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org) 22.12 ou plus récent et [Yarn](https://yarnpkg.com/getting-started/install).

**1. Installe git-push** (Linux ou macOS) :

```bash
git clone https://github.com/sarobidygmail12/gitkraken-cli.git git-push
cd git-push
yarn install
yarn build
mkdir -p ~/.local/bin
ln -s "$PWD/bin/git-push.js" ~/.local/bin/git-push
```

**2. Dis à Git qui tu es** (une seule fois) :

```bash
git config --global user.name "Ton Nom"
git config --global user.email "toi@example.com"
```

**3. Connecte-toi avec un token.** Crée-en un avec le droit de lire et d'écrire les dépôts, sur [GitHub](https://github.com/settings/tokens) (scope `repo`) ou [GitLab](https://gitlab.com/-/user_settings/personal_access_tokens) (scope `write_repository`). Lance `git-push`, tape `/login` et colle-le. Utilise l'adresse **HTTPS** de tes dépôts (`https://…`).

## 🎬 Ton premier projet en 4 étapes

1. **Crée un dépôt vide** sur <https://github.com/new> et copie son adresse.
2. **Ouvre ton projet** et lance git-push : `cd mon-projet` puis `git-push`.
3. **Relie-le à GitHub** : tape `/init`, appuie sur Entrée, colle l'adresse.
4. **Enregistre et envoie** : tape `/commit`. git-push demande confirmation car `main` est protégée : réponds oui. Il propose ensuite un message : choisis **Valider**.

Ton projet est sur GitHub ! 🎉 Ensuite, c'est toujours pareil : tu travailles, tu tapes `/commit`.

> [!IMPORTANT]
> `/commit` prend tous tes fichiers modifiés et les envoie tout de suite sur GitHub.

## 🖥️ Lire l'écran

```text
git-push mon-projet main (+3, -2, +3)
```

Nom du projet, branche, puis les fichiers pas encore enregistrés : 🟢 ajoutés, 🔴 supprimés, 🟠 modifiés. Les lignes grises montrent les vraies commandes Git lancées pour toi, pratique pour apprendre. Tape `/` pour voir les commandes, les flèches pour choisir, Tab pour compléter, Entrée pour valider.

## ⭐ Les commandes

### Enregistrer et partager ton travail

| Commande | Ce qu'elle fait | Ce qu'elle résout |
| --- | --- | --- |
| `/commit` | Enregistre tes modifications avec un message généré et les envoie | Plus de `git add`, `git commit -m`, `git push` un par un |
| `/amend` | Modifie le dernier commit pas encore envoyé | Une faute dans le message ou un fichier oublié |
| `/undo` | Annule le dernier commit pas encore envoyé, garde ton travail | Un commit fait trop tôt |
| `/push` | Envoie tes commits | Pose l'upstream pour toi sur une nouvelle branche |
| `/first-push` | Premier envoi quand GitHub contient déjà des fichiers | L'erreur `rejected` / `fetch first` sur un nouveau dépôt |
| `/pr` | Ouvre une pull request avec son titre et sa description déjà remplis | Plus de copier-coller entre le terminal et GitHub ; le titre reçoit un emoji (✨ feature, 🚒 correction de bug, 🚑️ hotfix, 🚀 le reste) |

### Rester à jour

| Commande | Ce qu'elle fait | Ce qu'elle résout |
| --- | --- | --- |
| `/status` | Montre où tu en es et ce qui a changé | Lire la sortie de `git status` |
| `/diff` | Résumé de tes modifications | Savoir ce que tu vas committer |
| `/pull` | Récupère les nouveautés, sans commit de fusion | Récupérer le travail de l'équipe sans risque |
| `/fetch` | Télécharge les nouveautés de tous les remotes | Voir les nouvelles branches sans toucher à la tienne |
| `/log` | Graphe de l'historique dans ton navigateur | Comprendre qui a fait quoi, sur quelle branche |

### Les branches

| Commande | Ce qu'elle fait | Ce qu'elle résout |
| --- | --- | --- |
| `/branch mon-idee` | Crée une branche et s'y place | Commencer un travail sans déranger `main` |
| `/switch main` | Change de branche, avec l'autocomplétion | Changer de branche avec du travail en cours : propose de le committer ou de le mettre de côté |
| `/delete mon-idee` | Supprime une branche en local, sur le remote ou les deux | Faire le ménage, en te prévenant si des commits seraient perdus |
| `/hotfix [nom]` | Crée `hotfix/<nom>` depuis develop | Une correction urgente depuis une base à jour |
| `/fix [nom]` | Crée `fix/<nom>` depuis preprod | Une correction sur la branche de pré-production |
| `/rebase` | Rejoue ta branche sur le dernier develop ou preprod | Un historique propre, avec les conflits guidés |
| `/cherry-pick <hash>` | Copie un commit d'une autre branche | Récupérer une correction sans toute la branche |
| `/stash [pop\|list]` | Met tes modifications de côté, puis les ramène | Changer de tâche sans committer un travail à moitié fait |

### Configuration et aide

| Commande | Ce qu'elle fait | Ce qu'elle résout |
| --- | --- | --- |
| `/init` | Crée un dépôt et le relie à GitHub | Démarrer un projet sans retenir `git init` et `git remote add` |
| `/login` | Enregistre un token d'accès | Un envoi refusé à cause d'un mot de passe |
| `/config` | Les réglages de ce dépôt dans ton navigateur | Modifier du JSON à la main |
| `/lang` | Change la langue | Utiliser git-push en anglais, français, chinois ou allemand |
| `/help` | Liste les commandes et ouvre l'aide complète | Retrouver une commande ou une option |
| `/clear`, `/exit` | Efface l'écran, quitte | |

Il existe des alias courts : `/cm` (commit), `/s` (status), `/sw` (switch), `/db` (delete-branch), `/rb` (rebase), `/cp` (cherry-pick), `/fp` (first-push), `/h` (help).

## 🆘 Quand ça coince

| Tu vois | Fais ceci |
| --- | --- |
| `rejected` ou `fetch first` au premier envoi | `/first-push` |
| `rejected` plus tard | `/pull`, puis `/push` |
| L'envoi échoue à cause d'un mot de passe | `/login` avec un nouveau token, et vérifie que `git remote -v` commence par `https://` |
| Un conflit | Ouvre le fichier, garde le bon texte, supprime les lignes `<<<<<<<`, `=======`, `>>>>>>>`, puis **Continuer**. Ou **Annuler tout** |
| Une erreur dans un commit déjà envoyé | Coupe l'envoi automatique pour vérifier d'abord : `/config set commit.autoPush false`, puis envoie avec `/push` |
| `detached HEAD` | `/switch main` |
| `not a Git repository` | Va dans le dossier de ton projet, ou `/init` |
| `git-push: command not found` | `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc` |

## 🛟 La sécurité intégrée

- Demande avant de committer sur une branche protégée (`main`, `develop`, `preprod` et `branches.protected`).
- Prévient avant d'inclure un fichier secret comme `.env`, et n'envoie jamais son contenu à l'IA.
- Bloque les commandes Git qui effacent du travail (`push --force`, `reset --hard`, `branch -D`, `clean`) sauf si tu confirmes.
- S'arrête au premier échec et montre la vraie erreur de Git.
- Les pages du navigateur ne répondent que sur ton ordinateur.

## 🤖 Messages écrits par l'IA (optionnel)

Avec l'IA, git-push écrit un titre qui explique le commit et quelques phrases sur ce qui a changé :

```text
fix(session): discard expired sessions when reading

The session read function now checks if a session's expiration time has passed.
```

Sans IA, il décrit les fichiers modifiés. Choisis un service :

- **Groq** (gratuit) : crée une clé sur <https://console.groq.com/keys>, puis ajoute `export GROQ_API_KEY="ta-clé"` à ton `~/.bashrc`.
- **Gemini** (offre gratuite) : crée une clé sur <https://aistudio.google.com/apikey>, puis ajoute `export GEMINI_API_KEY="ta-clé"`.
- **Ollama** (local, rien ne quitte ta machine) : lance `ollama pull qwen2.5-coder` et garde Ollama ouvert.

Si un service échoue, git-push essaie le suivant. Les messages de commit sont toujours en anglais.

> [!NOTE]
> Tes modifications sont envoyées au service d'IA pour écrire le message. Pour les fichiers secrets (`.env*`, `*.pem`, `*.key`, `id_rsa*`), seul le nom est envoyé.

## ⚙️ Les réglages

- `/config` ouvre la page de réglages de ce dépôt. Modifie, puis **Enregistrer** : ça écrit `.git-push.json`.
- `/config set <option> <valeur>` modifie ton fichier global `~/.git-push/config.json`.
- `/config browse`, `/config show`, `/config edit` fonctionnent dans le terminal.

La page `/help` documente chaque option.

## 🧑‍💻 Contribuer

```bash
yarn build       # TypeScript, CSS Tailwind, puis copie des pages web
yarn dev:css     # recompile le CSS à chaque modification
yarn typecheck
yarn test
```

Le code a un backend (`src/server` : container, serveur web, controllers, services), un frontend (`src/web` : vues Tailwind), les commandes CLI (`src/commands`) et l'accès bas niveau à Git (`src/core`). [CLAUDE.md](CLAUDE.md) dit quels fichiers toucher pour chaque type de feature, et `tests/architecture.test.ts` vérifie les règles. Tous les textes sont dans `src/lang/` (anglais, français, chinois, allemand) : chaque langue doit avoir les mêmes clés que `en.json`, et une nouvelle langue s'ajoute dans `src/lang/index.ts`. TypeScript reste en version 6, car Yarn 4.10 lui applique un patch qui échoue en version 7.

## 🌐 Site web

👉 [Visite le site de git-push](https://claude.ai/artifact/X84wVTqr1GgwitrGVLjxmp)

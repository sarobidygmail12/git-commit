# 🧭 git-push

<img width="788" height="532" alt="demo-commit-switch-branch" src="https://github.com/user-attachments/assets/89b715bd-0392-4691-9678-a2fcc50fdbd2" />

🇬🇧 English | [🇫🇷 Français](README.fr.md)

**Git with simple commands, right in your terminal.** You type `/commit`, git-push reads your changes, writes the commit message and sends your work to GitHub. New to Git? This page is for you. 👋

> [!NOTE]
> Screens are in English by default. Type `/lang` to switch to French, Chinese or German. Commands stay the same in every language.

## 🎯 What it solves

| Problem | With git-push |
| --- | --- |
| Git commands are hard to remember | One short command per task: `/commit`, `/pull`, `/switch`… with autocomplete |
| Writing a good commit message takes time | AI reads your changes and writes the message for you |
| Fear of breaking or losing your work | Dangerous commands are blocked, protected branches and secret files ask first |
| Conflicts are scary | A guided screen: continue, skip or cancel everything |
| The history is hard to read | A clear graph in your browser with `/log` |
| Settings live in JSON files | A settings page in your browser with `/config` |

## 📥 Install

You need [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org) 22.12 or newer and [Yarn](https://yarnpkg.com/getting-started/install).

**1. Install git-push** (Linux or macOS):

```bash
git clone https://github.com/sarobidygmail12/gitkraken-cli.git git-push
cd git-push
yarn install
yarn build
mkdir -p ~/.local/bin
ln -s "$PWD/bin/git-push.js" ~/.local/bin/git-push
```

**2. Tell Git who you are** (once):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

**3. Connect with a token.** Create one with the right to read and write repositories, on [GitHub](https://github.com/settings/tokens) (scope `repo`) or [GitLab](https://gitlab.com/-/user_settings/personal_access_tokens) (scope `write_repository`). Start `git-push`, type `/login` and paste it. Use the **HTTPS** address of your repositories (`https://…`).

## 🎬 Your first project in 4 steps

1. **Create an empty repository** at <https://github.com/new> and copy its address.
2. **Open your project** and start git-push: `cd my-project` then `git-push`.
3. **Link it to GitHub**: type `/init`, press Enter, paste the address.
4. **Save and send**: type `/commit`. git-push asks for confirmation because `main` is protected: answer yes. It then suggests a message: choose **Accept**.

Your project is on GitHub! 🎉 From then on: you work, you type `/commit`.

> [!IMPORTANT]
> `/commit` takes all your changed files and sends them to GitHub right away.

## 🖥️ Reading the screen

```text
git-push my-project main (+3, -2, +3)
```

Project name, branch, then files not saved yet: 🟢 added, 🔴 deleted, 🟠 modified. The grey lines show the real Git commands run for you, handy for learning. Type `/` to see the commands, arrows to choose, Tab to complete, Enter to confirm.

## ⭐ Commands

### Save and share your work

| Command | What it does | Solves |
| --- | --- | --- |
| `/commit` | Saves your changes with a generated message and sends them | No more `git add`, `git commit -m`, `git push` one by one |
| `/amend` | Changes the last commit not sent yet | A typo in the message or a forgotten file |
| `/undo` | Cancels the last commit not sent yet, keeps your work | Committed too early |
| `/push` | Sends your commits | Sets the upstream for you on a new branch |
| `/first-push` | First send when GitHub already has files | The `rejected` / `fetch first` error on a new repository |
| `/pr` | Opens a pull request with its title and description filled in | No copy-paste between the terminal and GitHub; the title gets an emoji (✨ feature, 🚒 bug fix, 🚑️ hotfix, 🚀 other) |

### Stay up to date

| Command | What it does | Solves |
| --- | --- | --- |
| `/status` | Shows where you are and what changed | Reading `git status` output |
| `/diff` | Summary of your changes | Knowing what you are about to commit |
| `/pull` | Brings what's new, without merge commits | Getting the team's work safely |
| `/fetch` | Downloads the news from every remote | Seeing new branches without touching yours |
| `/log` | History graph in your browser | Understanding who did what, on which branch |

### Branches

| Command | What it does | Solves |
| --- | --- | --- |
| `/branch my-idea` | Creates a branch and moves to it | Starting work without disturbing `main` |
| `/switch main` | Moves to another branch, with autocomplete | Changing branch with unsaved work: it offers to commit or set it aside |
| `/delete my-idea` | Deletes a branch locally, on the remote or both | Cleaning up, and it tells you if commits would be lost |
| `/hotfix [name]` | Creates `hotfix/<name>` from develop | An urgent fix from an up-to-date base |
| `/fix [name]` | Creates `fix/<name>` from preprod | A fix on the pre-production branch |
| `/rebase` | Replays your branch on the latest develop or preprod | A clean history, with guided conflicts |
| `/cherry-pick <hash>` | Copies a commit from another branch | Bringing one fix without the whole branch |
| `/stash [pop\|list]` | Sets your changes aside, then brings them back | Switching tasks without committing half-done work |

### Setup and help

| Command | What it does | Solves |
| --- | --- | --- |
| `/init` | Creates a repository and links it to GitHub | Starting a project without remembering `git init` and `git remote add` |
| `/login` | Saves an access token | Push refused because of a password |
| `/config` | This repository's settings in your browser | Editing JSON by hand |
| `/lang` | Changes the language | Using git-push in English, French, Chinese or German |
| `/help` | Lists commands and opens the full help | Finding a command or an option |
| `/clear`, `/exit` | Clears the screen, quits | |

Short aliases exist: `/cm` (commit), `/s` (status), `/sw` (switch), `/db` (delete-branch), `/rb` (rebase), `/cp` (cherry-pick), `/fp` (first-push), `/h` (help).

## 🆘 When something goes wrong

| You see | Do this |
| --- | --- |
| `rejected` or `fetch first` on your first send | `/first-push` |
| `rejected` later on | `/pull`, then `/push` |
| Sending fails because of a password | `/login` with a new token, and check `git remote -v` starts with `https://` |
| A conflict | Open the file, keep the right text, delete the `<<<<<<<`, `=======`, `>>>>>>>` lines, then **Continue**. Or **Cancel everything** |
| A mistake in a commit already sent | Turn off automatic sending to check first: `/config set commit.autoPush false`, then send with `/push` |
| `detached HEAD` | `/switch main` |
| `not a Git repository` | Go to your project folder, or `/init` |
| `git-push: command not found` | `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc` |

## 🛟 Built-in safety

- Asks before committing on a protected branch (`main`, `develop`, `preprod` and `branches.protected`).
- Warns before including a secret file such as `.env`, and never sends its content to the AI.
- Blocks Git commands that erase work (`push --force`, `reset --hard`, `branch -D`, `clean`) unless you confirm.
- Stops on the first failure and shows the real Git error.
- The browser pages only answer on your own computer.

## 🤖 AI messages (optional)

With AI, git-push writes a title that explains the commit and a few sentences about what changed:

```text
fix(session): discard expired sessions when reading

The session read function now checks if a session's expiration time has passed.
```

Without AI, it describes the changed files. Pick one service:

- **Groq** (free): create a key at <https://console.groq.com/keys>, then add `export GROQ_API_KEY="your-key"` to your `~/.bashrc`.
- **Gemini** (free tier): create a key at <https://aistudio.google.com/apikey>, then add `export GEMINI_API_KEY="your-key"`.
- **Ollama** (local, nothing leaves your machine): run `ollama pull qwen2.5-coder` and keep Ollama running.

If one service fails, git-push tries the next. Commit messages are always in English.

> [!NOTE]
> Your changes are sent to the AI service to write the message. Secret files (`.env*`, `*.pem`, `*.key`, `id_rsa*`) only send their name.

## ⚙️ Settings

- `/config` opens this repository's settings page. Change, then **Save**: it writes `.git-push.json`.
- `/config set <option> <value>` changes your global file `~/.git-push/config.json`.
- `/config browse`, `/config show`, `/config edit` work in the terminal.

The `/help` page documents every option.

## 🧑‍💻 Contributing

```bash
yarn build       # TypeScript, Tailwind CSS, then copies the web pages
yarn dev:css     # rebuilds the CSS on every change
yarn typecheck
yarn test
```

The code has a backend (`src/server`: container, web server, controllers, services), a frontend (`src/web`: Tailwind views), the CLI commands (`src/commands`) and low-level Git access (`src/core`). [CLAUDE.md](CLAUDE.md) says which files to touch for each kind of feature, and `tests/architecture.test.ts` checks the rules. Every text lives in `src/lang/` (English, French, Chinese, German): each language must have the same keys as `en.json`, and a new language is added in `src/lang/index.ts`. TypeScript stays on version 6, because Yarn 4.10 applies a patch to it that fails on version 7.

## 🌐 Website

👉 [Visit the git-push website](https://claude.ai/artifact/X84wVTqr1GgwitrGVLjxmp)

import { resolve } from "node:path";
import { DEFAULT_REMOTE } from "../constants/git.js";
import type { Command, CommandContext } from "../contracts/command.js";
import { t } from "../lang/index.js";
import {
  addDefaultRemote,
  assertValidRemoteUrl,
  findRepoRootOf,
  hasDefaultRemoteAt,
  initRepository,
  resolveDirectory,
} from "../server/services/repo.js";


export const initCommand: Command = {
  name: "init",
  get description() {
    return t("cmd.init");
  },
  usage: "/init",
  examples: ["/init"],
  gitSteps: ["git -C <folder> init -b <branches.main>", "git -C <folder> remote add origin <url>"],
  run: async (ctx) => {
    const directory = await askDirectory(ctx);
    if (directory === undefined) return;

    const existingRoot = await findRepoRootOf(ctx.git, directory);
    if (existingRoot) {
      ctx.ui.log(t("init.existing", { root: existingRoot }), "warn");
      if (await hasDefaultRemoteAt(ctx.git, existingRoot)) return;
    }

    const remoteUrl = await askRemoteUrl(ctx);
    if (remoteUrl === undefined) return;

    if (!existingRoot) {
      await initRepository(ctx.git, directory, ctx.config.branches.main);
      ctx.ui.log(t("init.done", { directory, branch: ctx.config.branches.main }), "success");
    }
    const root = existingRoot ?? directory;
    if (remoteUrl !== "") {
      await addDefaultRemote(ctx.git, root, remoteUrl);
      ctx.ui.log(t("init.remote", { name: DEFAULT_REMOTE, url: remoteUrl }), "success");
    }
    if (directory !== resolve(ctx.git.cwd)) {
      ctx.ui.log(t("init.sessionStays", { cwd: ctx.git.cwd, root }));
    }
  },
};

async function askDirectory(ctx: CommandContext): Promise<string | undefined> {
  const answer = (await ctx.ui.ask(t("init.folderPrompt"), { initial: ctx.git.cwd }))?.trim();
  if (answer === undefined) return undefined;
  return resolveDirectory(ctx.git.cwd, answer);
}

async function askRemoteUrl(ctx: CommandContext): Promise<string | undefined> {
  const url = (await ctx.ui.ask(t("init.urlPrompt")))?.trim();
  if (url === undefined) return undefined;
  assertValidRemoteUrl(url);
  return url;
}

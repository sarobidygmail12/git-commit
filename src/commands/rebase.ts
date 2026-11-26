import { DEFAULT_REMOTE } from "../constants/git.js";
import { GitError } from "../core/errors.js";
import { assertNoOperationInProgress, getStatus } from "../core/git/status.js";
import { resolveSequence } from "./shared/resolveSequence.js";
import { secureWorkingTree } from "./shared/secureWorkingTree.js";
import type { Command, CommandContext } from "../contracts/command.js";
import { t } from "../lang/index.js";
import { assertValidBranchName, isProtectedBranch } from "../server/services/branch.js";
import { fetchFromDefaultRemote, forcePushWithLease, hasDiverged, isSequenceRunning, startRebase } from "../server/services/sync.js";

export const rebaseCommand: Command = {
  name: "rebase",
  aliases: ["rb"],
  get description() {
    return t("cmd.rebase");
  },
  usage: "/rebase [develop|preprod]",
  examples: ["/rebase", "/rebase develop", "/rebase preprod"],
  get gitSteps() {
    return [
    "git fetch origin <base>",
    t("step.commitOrStashIfDirty"),
    "git rebase origin/<base>",
    t("step.conflictRebase"),
    t("step.forcePushAfterConfirm"),
  ];
  },
  completeArgs: (ctx) => Promise.resolve(listBases(ctx)),
  run: async (ctx, [requestedBase]) => {
    if (await isSequenceRunning(ctx.git, "rebase")) return finishRebase(ctx);
    await assertNoOperationInProgress(ctx.git);

    const base = await chooseBase(ctx, requestedBase);
    if (!base) {
      ctx.ui.log(t("rebase.cancelled"), "warn");
      return;
    }
    await rebaseOnLatest(ctx, base);
  },
};

function listBases(ctx: CommandContext): string[] {
  return [ctx.config.branches.develop, ctx.config.branches.preprod];
}

async function chooseBase(ctx: CommandContext, requestedBase: string | undefined): Promise<string | undefined> {
  const bases = listBases(ctx);
  if (requestedBase === undefined) {
    return ctx.ui.select(t("rebase.selectBase"), bases.map((base) => ({ label: base, value: base })));
  }
  if (!bases.includes(requestedBase)) throw new GitError(t("rebase.unknownBase", { base: requestedBase, choices: bases.join(", ") }));
  return requestedBase;
}

async function rebaseOnLatest(ctx: CommandContext, base: string): Promise<void> {
  // La base peut venir d'un .git-commit.json : un nom comme `--upload-pack=…` ne doit jamais atteindre git fetch.
  await assertValidBranchName(ctx.git, base);
  const { branch } = await getStatus(ctx.git);
  if (!branch) throw new GitError(t("head.switchFirst"));

  await ctx.ui.spinner(t("spinner.fetchRemote", { remote: `${DEFAULT_REMOTE}/${base}` }), () => fetchFromDefaultRemote(ctx.git, base));

  if (!(await confirmProtectedRebase(ctx, branch)) || !(await secureWorkingTree(ctx, `/rebase ${base}`))) {
    ctx.ui.log(t("rebase.cancelled"), "warn");
    return;
  }

  await startRebase(ctx.git, `${DEFAULT_REMOTE}/${base}`);
  await finishRebase(ctx);
}

async function confirmProtectedRebase(ctx: CommandContext, branch: string): Promise<boolean> {
  if (!isProtectedBranch(ctx.config, branch)) return true;
  return ctx.ui.confirm(t("rebase.protectedConfirm", { branch }));
}

async function finishRebase(ctx: CommandContext): Promise<void> {
  if ((await resolveSequence(ctx, "rebase")) !== "completed") return;
  ctx.ui.log(t("rebase.done"), "success");
  await offerForcePush(ctx);
}

/** Après un rebase, une branche déjà poussée a divergé : seul un push forcé peut la mettre à jour. */
async function offerForcePush(ctx: CommandContext): Promise<void> {
  const status = await getStatus(ctx.git);
  if (!hasDiverged(status)) return;

  const question = t("rebase.forcePushConfirm", { branch: status.branch ?? t("firstPush.theBranch"), upstream: status.upstream ?? "" });
  if (!(await ctx.ui.confirm(question))) {
    ctx.ui.log(t("rebase.notPushed"), "warn");
    return;
  }
  await ctx.ui.spinner(t("spinner.push"), () => forcePushWithLease(ctx.git));
  ctx.ui.log(t("commit.pushed"), "success");
}

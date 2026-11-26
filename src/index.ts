import { render } from "ink";
import { createElement } from "react";
import { globalConfigPath } from "./core/config/loadConfig.js";
import { t } from "./lang/index.js";
import { createContainer } from "./server/container.js";
import { App } from "./ui/App.js";

async function main(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error(t("app.needsTerminal"));
    process.exitCode = 1;
    return;
  }
  const container = await createContainer({ launchDirectory: process.cwd(), globalConfigPath: globalConfigPath(), env: process.env });
  const app = render(createElement(App, { createSession: container.startSession, cwd: container.cwd }));
  await app.waitUntilExit();
}

await main();

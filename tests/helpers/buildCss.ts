import { execFileSync } from "node:child_process";

/** Les pages chargent /assets/app.css : il est compilé une fois avant les tests, comme au build. */
export default function buildCss(): void {
  execFileSync("node_modules/.bin/tailwindcss", ["-i", "src/web/styles/app.css", "-o", "src/web/assets/app.css", "--minify"], {
    stdio: "ignore",
  });
}

import { cp, rm } from "node:fs/promises";

// Le serveur compilé (dist/server) lit dist/web : templates, vues et assets, dont app.css produit par Tailwind.
const FRONTEND_FOLDERS = ["templates", "views", "assets"];

await rm("dist/web", { recursive: true, force: true });
await Promise.all(FRONTEND_FOLDERS.map((folder) => cp(`src/web/${folder}`, `dist/web/${folder}`, { recursive: true })));

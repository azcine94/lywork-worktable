import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await Promise.all([
  copyFile("src/core.js", "dist/core.js"),
  copyFile("src/index.js", "dist/index.js"),
  copyFile("src/styles.css", "dist/styles.css"),
]);

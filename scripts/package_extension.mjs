import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { ZipArchive } = require("archiver");

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "apps/extension/dist");
const target = resolve(root, "apps/web/public/verity-extension.zip");

await mkdir(dirname(target), { recursive: true });
await rm(target, { force: true });

await new Promise((resolvePromise, reject) => {
  const output = createWriteStream(target);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on("close", resolvePromise);
  output.on("error", reject);
  archive.on("error", reject);
  archive.pipe(output);
  archive.directory(source, false);
  void archive.finalize();
});

console.log(`Packaged Chrome extension at ${target}`);

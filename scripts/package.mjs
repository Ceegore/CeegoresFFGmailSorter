import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const releaseDir = resolve("artifacts/release");
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
const webExt = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "web-ext.cmd" : "web-ext",
);
await exec(
  webExt,
  ["build", "--source-dir", "dist", "--artifacts-dir", releaseDir, "--overwrite-dest"],
  {
    shell: false,
  },
);
await exec(
  "git",
  ["archive", "--format=zip", "--output", resolve(releaseDir, "source.zip"), "HEAD"],
  {
    shell: false,
  },
);

const files = (await readdir(releaseDir)).filter((name) => /\.(zip|xpi)$/u.test(name)).sort();
if (files.length < 2) throw new Error("Expected extension archive and source archive");
const lines = [];
for (const name of files) {
  const bytes = await readFile(resolve(releaseDir, name));
  lines.push(`${createHash("sha256").update(bytes).digest("hex")}  ${name}`);
}
await writeFile(resolve(releaseDir, "SHA256SUMS.txt"), `${lines.join("\n")}\n`);
console.log("Fresh release artifacts created.");

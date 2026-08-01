import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const releaseDir = resolve("artifacts/release");

// REL-001: verify a clean working tree so the dist built from it matches the
// source.zip archived from HEAD. git is a real executable, so shell:false.
const { stdout: status } = await exec("git", ["status", "--porcelain"], {
  shell: false,
});
if (status.trim()) {
  throw new Error(
    "Working tree is not clean. Commit or stash changes before packaging.\n" + status,
  );
}

// REL-002: run verification gates (minus e2e and audit, which need extra setup)
// before building so package never emits an unverified release.
console.log("Running verification gates...");
await exec("npm", ["run", "format:check"], { shell: true });
await exec("npm", ["run", "lint"], { shell: true });
await exec("npm", ["run", "typecheck"], { shell: true });
await exec("npm", ["run", "test"], { shell: true });

// ITI-063: rebuild dist from source before packaging so a stale/older dist can
// never be bundled into a release artifact. build.mjs resolves its own root via
// import.meta.dirname, so running it from the project root reproduces a clean
// dist identical to `npm run build`.
console.log("Building fresh dist...");
await exec(process.execPath, [resolve("scripts/build.mjs")], {
  shell: false,
});

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
    // REL-003: only Windows needs a shell because the binary is web-ext.cmd;
    // Node refuses to spawn .cmd/.bat files with shell:false. Other platforms
    // use a real executable and run without a shell.
    shell: process.platform === "win32",
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

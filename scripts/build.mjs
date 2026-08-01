import { build } from "vite";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  throw new Error("package.json contains no valid WebExtension version");
}

async function buildEntry(entry, fileName) {
  await build({
    root,
    publicDir: false,
    build: {
      emptyOutDir: false,
      sourcemap: false,
      minify: false,
      target: "firefox140",
      outDir: dist,
      lib: {
        entry: resolve(root, entry),
        name: fileName.replace(/\W+/g, "_"),
        formats: ["iife"],
        fileName: () => fileName,
      },
      rollupOptions: { output: {} },
    },
  });
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await buildEntry("src/background/index.ts", "background.js");
await buildEntry("src/content/index.ts", "content.js");
await cp(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });

const manifest = JSON.parse(await readFile(resolve(root, "public/manifest.json"), "utf8"));
if (manifest.version !== packageJson.version) {
  throw new Error(
    `Manifest version ${manifest.version} differs from package version ${packageJson.version}`,
  );
}
await writeFile(resolve(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

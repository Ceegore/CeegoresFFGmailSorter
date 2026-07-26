import { readdir, readFile, stat } from "node:fs/promises";

const allowedTopLevel = new Set(["manifest.json", "background.js", "content.js", "icons"]);
for (const entry of await readdir("dist")) {
  if (!allowedTopLevel.has(entry)) throw new Error(`Unexpected dist entry: ${entry}`);
}
for (const file of ["dist/background.js", "dist/content.js"]) {
  const info = await stat(file);
  if (info.size === 0) throw new Error(`${file} is empty`);
  if (info.size > 750_000) throw new Error(`${file} exceeds 750 KB review budget`);
  const content = await readFile(file, "utf8");
  if (/sourceMappingURL/u.test(content)) throw new Error(`${file} contains a source map reference`);
  if (/made by Ceegore/u.test(content) === false && file.endsWith("content.js")) {
    throw new Error("content.js does not contain the locked overlay credit");
  }
}
console.log("Distribution layout verified.");

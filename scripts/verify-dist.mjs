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
  // ITI-067: NOTE — the brand-credit check verifies only that the literal
  // string is present in the bundle. It does NOT prove the credit is actually
  // rendered at runtime. The unit tests (src/ui/brand-credit.test.ts and the
  // shadow-DOM assertions in render.test.ts / views.test.ts) provide the
  // stronger evidence that the credit is mounted in the overlay. This gate
  // catches the simpler accident: the constant being stripped or renamed in the
  // bundle during build.
  if (/made by Ceegore/u.test(content) === false && file.endsWith("content.js")) {
    throw new Error("content.js does not contain the locked overlay credit");
  }
}

// H-3: verify the 4 required manifest-referenced icons exist and are
// non-empty. A missing/empty icon would make the extension install but render
// with a broken toolbar icon, which is easy to miss in a layout-only check.
for (const size of [16, 32, 48, 96]) {
  const iconPath = `dist/icons/icon-${size}.png`;
  try {
    const iconStat = await stat(iconPath);
    if (iconStat.size === 0) throw new Error(`${iconPath} is empty`);
  } catch {
    throw new Error(`${iconPath} is missing`);
  }
}
console.log("Icons verified.");
console.log("Distribution layout verified.");

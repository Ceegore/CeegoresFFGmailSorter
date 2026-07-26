import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const forbidden = [
  ["fetch", /\bfetch\s*\(/u],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
  ["WebSocket", /\bWebSocket\b/u],
  ["EventSource", /\bEventSource\b/u],
  ["sendBeacon", /\bnavigator\.sendBeacon\b/u],
  ["importScripts", /\bimportScripts\s*\(/u],
  ["remote dynamic import", /\bimport\s*\(\s*["'`]https?:\/\//u],
  ["eval", /\beval\s*\(/u],
  ["new Function", /\bnew\s+Function\b/u],
  ["document.cookie", /\bdocument\.cookie\b/u],
];

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(full)));
    else if (/\.(ts|js|mjs)$/u.test(entry.name)) result.push(full);
  }
  return result;
}

const roots = ["src", "dist"];
const failures = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const content = await readFile(file, "utf8");
    for (const [name, pattern] of forbidden) {
      if (pattern.test(content)) failures.push(`${file}: ${name}`);
    }
  }
}

if (failures.length) {
  console.error(
    `Forbidden network, cookie or dynamic-code patterns found:\n${failures.join("\n")}`,
  );
  process.exit(1);
}
console.log("No forbidden network, cookie or dynamic-code primitives found.");

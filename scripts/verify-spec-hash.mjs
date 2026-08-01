// BUG-060: verify the locked product specification SHA-256 before build, tests,
// and packaging. Aborts on mismatch so a silently-edited spec cannot ship.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SPEC_PATH = "docs/PRODUCT_SPEC.md";
const HASH_PATH = "docs/SPEC_SHA256.txt";

const specBytes = await readFile(SPEC_PATH);
const actual = createHash("sha256").update(specBytes).digest("hex");
const hashFile = await readFile(HASH_PATH, "utf8");
const recorded = hashFile.trim().split(/\s+/)[0];

if (actual !== recorded) {
  console.error(
    `Spec SHA-256 mismatch!\n  expected: ${recorded}\n  actual:   ${actual}\n` +
      `The spec file or its hash was modified. Re-run: sha256sum ${SPEC_PATH} > ${HASH_PATH}`,
  );
  process.exit(1);
}
console.log("Spec SHA-256 verified.");

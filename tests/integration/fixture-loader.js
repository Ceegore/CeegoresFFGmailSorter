import { readFileSync } from "node:fs";
import { resolve } from "node:path";
/** Load a fixture HTML file into the current jsdom document, replacing body. */
export function loadFixture(name) {
  const path = resolve(import.meta.dirname, "..", "fixtures", name);
  const html = readFileSync(path, "utf8");
  const dom = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.innerHTML = dom.documentElement.innerHTML;
  // jsdom DOMParser does not wire location; tests set location.hash explicitly.
}
/** Set the SPA route hash for view detection. */
export function setRoute(hash) {
  const w = window;
  if (w.__gisoSetRoute) {
    w.__gisoSetRoute(hash);
  } else {
    history.replaceState(null, "", hash);
  }
}

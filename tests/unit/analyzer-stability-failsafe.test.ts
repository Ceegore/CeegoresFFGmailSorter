// Regression test for retest Fix #2/#3: the inbox analyzer must fail safe
// (GISO-DOM-CHANGED-001) when the message list never stabilizes for a
// continuous 250ms window within the deadline, instead of snapshotting a
// still-mutating list. The detached/replacement-list re-stabilization loop is
// now bounded by the same waitForListStability helper (250ms window, 5s
// deadline) and also fails safe.
//
// This file intentionally does NOT mock @/analyzer/inbox-analyzer so the real
// implementation (including waitForListStability) runs.
import { beforeEach, describe, expect, it } from "vitest";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";
import { toAppError } from "@/shared/errors";

function installLocation(hash = "#inbox"): void {
  const state = {
    hash,
    pathname: "/mail/u/0/",
    hostname: "mail.google.com",
    search: "",
    get href(): string {
      return `https://${state.hostname}${state.pathname}${state.hash}`;
    },
  };
  Object.defineProperty(window, "location", {
    writable: true,
    configurable: true,
    value: state,
  });
}

function installStableInboxShell(): HTMLElement {
  document.body.innerHTML = "";
  const main = document.createElement("div");
  main.setAttribute("role", "main");
  document.body.append(main);
  // Active inbox nav so detectCurrentView accepts the #inbox route.
  const inboxLink = document.createElement("a");
  inboxLink.setAttribute("href", "#inbox");
  inboxLink.setAttribute("aria-current", "page");
  inboxLink.textContent = "Posteingang";
  document.body.append(inboxLink);
  return main;
}

describe("Fix #2/#3: analyzer stability fail-safe", () => {
  beforeEach(() => {
    installLocation("#inbox");
    const main = installStableInboxShell();
    // A baseline stable mail list so a normal analysis would otherwise succeed.
    const list = document.createElement("div");
    list.setAttribute("role", "list");
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    row.setAttribute("data-thread-id", "r0");
    const opener = document.createElement("a");
    opener.setAttribute("href", "#inbox/r0");
    row.append(opener);
    list.append(row);
    main.append(list);
  });

  it("fails safe (GISO-DOM-CHANGED-001) when the list never stabilizes", async () => {
    // Continuously change the list's ROW COUNT so the stability fingerprint
    // (count;ids) differs on every 50ms poll and the continuous 250ms window
    // can never be reached. Appending/removing a row guarantees a fingerprint
    // change regardless of poll/mutator timing alignment.
    const list = document.querySelector('[role="main"] [role="list"]');
    if (!list) throw new Error("test setup: list missing");
    let counter = 0;
    const mutator = window.setInterval(() => {
      counter += 1;
      const extra = document.createElement("div");
      extra.setAttribute("role", "listitem");
      extra.setAttribute("data-thread-id", `churn-${String(counter)}`);
      const opener = document.createElement("a");
      opener.setAttribute("href", "#inbox/churn");
      extra.append(opener);
      list.append(extra);
      // Remove a previous churn row to keep the count oscillating.
      const prev = list.querySelector('[data-thread-id^="churn-"]');
      if (prev && list.children.length > 2) prev.remove();
    }, 15);
    try {
      const err = await analyzeCurrentInbox(new AbortController().signal).catch((e: unknown) => e);
      // With a continuously churning list, the analyzer must refuse to snapshot
      // once the 10s deadline expires without a continuous 250ms stable window.
      expect(err).toBeInstanceOf(Error);
      expect(toAppError(err).code).toBe("GISO-DOM-CHANGED-001");
    } finally {
      window.clearInterval(mutator);
    }
  }, 20_000);

  it("succeeds on a genuinely stable list (control case)", async () => {
    // Sanity check: without the churn, the same setup must analyze normally,
    // proving the fail-safe above fired due to instability, not setup error.
    const result = await analyzeCurrentInbox(new AbortController().signal);
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it("re-resolves and re-stabilizes when the list node is replaced mid-analysis", async () => {
    // CUR-017: Gmail may swap the list node during the stability window. The
    // analyzer must detect the detached original, re-resolve to the fresh list,
    // and run a second bounded stability wait on it before scanning. We detach
    // the original list shortly after analysis starts and attach a fresh stable
    // list in its place.
    const main = document.querySelector('[role="main"]');
    if (!main) throw new Error("test setup: main missing");
    const originalList = document.querySelector('[role="main"] [role="list"]');
    if (!originalList) throw new Error("test setup: original list missing");
    // After a short delay, swap the list for a fresh stable one.
    const swap = window.setTimeout(() => {
      originalList.remove();
      const freshList = document.createElement("div");
      freshList.setAttribute("role", "list");
      const row = document.createElement("div");
      row.setAttribute("role", "listitem");
      row.setAttribute("data-thread-id", "fresh0");
      const opener = document.createElement("a");
      opener.setAttribute("href", "#inbox/fresh0");
      row.append(opener);
      freshList.append(row);
      main.append(freshList);
    }, 80);
    try {
      const result = await analyzeCurrentInbox(new AbortController().signal);
      // The fresh list's row is scanned (re-resolve + re-stabilize succeeded).
      expect(result.rowCount).toBeGreaterThan(0);
    } finally {
      window.clearTimeout(swap);
    }
  }, 15_000);
});

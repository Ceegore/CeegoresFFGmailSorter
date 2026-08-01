import { beforeEach, describe, expect, it } from "vitest";
import {
  buildInboxSenderQuery,
  findSearchBox,
  normalizeQueryForComparison,
  setNativeInputValue,
  submitAndWaitUntilReady,
} from "@/gmail/search-controller";
import { toAppError } from "@/shared/errors";
function installGmailSearchDom(onSubmit) {
  document.body.innerHTML = "";
  const form = document.createElement("form");
  const box = document.createElement("input");
  box.type = "text";
  box.setAttribute("aria-label", "Suche");
  const button = document.createElement("button");
  button.type = "submit";
  button.setAttribute("aria-label", "Suche");
  button.textContent = "Suche";
  form.append(box, button);
  document.body.append(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit();
  });
  return { button, box };
}
describe("search controller", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        hostname: "mail.google.com",
        pathname: "/mail/u/0/",
        hash: "#inbox",
        search: "",
        href: "https://mail.google.com/mail/u/0/#inbox",
      },
    });
  });
  it("finds the labelled search box", () => {
    installGmailSearchDom(() => {
      /* no-op submit */
    });
    expect(findSearchBox()).not.toBeNull();
  });
  it("setNativeInputValue updates value and dispatches events", () => {
    installGmailSearchDom(() => {
      /* no-op submit */
    });
    const box = findSearchBox();
    if (!box) throw new Error("search box missing");
    setNativeInputValue(box, 'in:inbox "from:x@example.com"');
    expect(box.value).toBe('in:inbox "from:x@example.com"');
  });
  it("returns ready evidence when results appear", async () => {
    installGmailSearchDom(() => {
      window.location.hash = "#search/from:x";
      const list = document.createElement("div");
      list.setAttribute("role", "list");
      const row = document.createElement("div");
      row.setAttribute("role", "listitem");
      list.append(row);
      document.body.append(list);
    });
    const ac = new AbortController();
    const evidence = await submitAndWaitUntilReady(
      buildInboxSenderQuery("x@example.com"),
      ac.signal,
      { timeoutMs: 2000, stabilityMs: 60 },
    );
    expect(evidence.queryMatches).toBe(true);
    expect(evidence.mailListDetected).toBe(true);
    expect(evidence.relatedOnlyDetected).toBe(false);
  });
  it("aborts cleanly", async () => {
    installGmailSearchDom(() => {
      // never resolves
    });
    const ac = new AbortController();
    const promise = submitAndWaitUntilReady(buildInboxSenderQuery("x@example.com"), ac.signal, {
      timeoutMs: 5000,
      stabilityMs: 50,
    });
    ac.abort();
    await expect(promise).rejects.toThrow();
  });
  it("rejects related-only results", async () => {
    installGmailSearchDom(() => {
      window.location.hash = "#search/from:x";
      const banner = document.createElement("div");
      banner.setAttribute("role", "status");
      banner.textContent = "Ähnliche Ergebnisse";
      document.body.append(banner);
    });
    await expect(
      submitAndWaitUntilReady(
        buildInboxSenderQuery("x@example.com"),
        new AbortController().signal,
        {
          timeoutMs: 1000,
          stabilityMs: 50,
        },
      ),
    ).rejects.toMatchObject({ app: { code: "GISO-SEARCH-RELATED-ONLY-001" } });
  });
  it("query mismatch is rejected before any selection", async () => {
    installGmailSearchDom(() => {
      // Simulate Gmail ignoring the query and keeping something else.
      window.location.hash = "#search/from:x";
      const list = document.createElement("div");
      const row = document.createElement("div");
      row.setAttribute("role", "listitem");
      list.append(row);
      document.body.append(list);
      // Overwrite the box value AFTER submit so it no longer matches.
      const box = findSearchBox();
      if (!box) throw new Error("search box missing");
      box.value = "something else";
    });
    const err = await submitAndWaitUntilReady(
      buildInboxSenderQuery("x@example.com"),
      new AbortController().signal,
      { timeoutMs: 800, stabilityMs: 50 },
    ).catch((e) => e);
    const app = toAppError(err);
    expect(app.code).toBe("GISO-SEARCH-MISMATCH-001");
  });
  it("normalizeQueryForComparison treats curly quotes and extra spaces as equal", () => {
    expect(normalizeQueryForComparison("in:inbox  “from:x@example.com”")).toBe(
      normalizeQueryForComparison('in:inbox "from:x@example.com"'),
    );
  });
});

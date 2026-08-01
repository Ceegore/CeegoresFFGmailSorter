import { beforeEach, describe, expect, it } from "vitest";
import {
  buildInboxSenderQuery,
  findSearchBox,
  findSearchSubmitButton,
  normalizeQueryForComparison,
  setNativeInputValue,
  submitAndWaitUntilReady,
} from "@/gmail/search-controller";
import { toAppError } from "@/shared/errors";

function installGmailSearchDom(onSubmit: () => void): {
  button: HTMLElement;
  box: HTMLInputElement;
} {
  document.body.innerHTML = "";
  // ITI-008: Gmail's main search lives inside a [role="search"] landmark.
  // Mirror that structure so findSearchBox/findSearchSubmitButton resolve the
  // real search controls and never match Chat/Spaces/Contacts search inputs.
  const searchLandmark = document.createElement("div");
  searchLandmark.setAttribute("role", "search");
  const form = document.createElement("form");
  const box = document.createElement("input");
  box.type = "text";
  box.setAttribute("aria-label", "Suche");
  const button = document.createElement("button");
  button.type = "submit";
  button.setAttribute("aria-label", "Suche");
  button.textContent = "Suche";
  form.append(box, button);
  searchLandmark.append(form);
  document.body.append(searchLandmark);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit();
  });
  return { button, box };
}

/**
 * Install a primary mail list inside [role="main"] so CUR-004's
 * findMessageListElement() scoping resolves it. Each row carries a stable
 * data-thread-id (so CUR-014's tightened looksLikeMessageRow() counts it) plus
 * an opener anchor.
 */
function installMailList(rows = 1): HTMLElement {
  const main = document.createElement("div");
  main.setAttribute("role", "main");
  const list = document.createElement("div");
  list.setAttribute("role", "list");
  for (let i = 0; i < rows; i += 1) {
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    row.setAttribute("data-thread-id", "r" + String(i));
    const opener = document.createElement("a");
    opener.setAttribute("href", "#inbox/r" + String(i));
    row.append(opener);
    list.append(row);
  }
  main.append(list);
  document.body.append(main);
  return main;
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
      // CUR-004: results must live inside the primary mail list (scoped to
      // [role="main"]) for findMessageListElement/mailListDetected to see them.
      installMailList();
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
      // CUR-005: status text is only read from regions inside [role="main"]
      // or a header, so the banner must live in the main surface.
      const main = document.createElement("div");
      main.setAttribute("role", "main");
      const banner = document.createElement("div");
      banner.setAttribute("role", "status");
      banner.textContent = "Ähnliche Ergebnisse";
      main.append(banner);
      document.body.append(main);
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
    ).catch((e: unknown) => e);
    const app = toAppError(err);
    expect(app.code).toBe("GISO-SEARCH-MISMATCH-001");
  });

  it("normalizeQueryForComparison treats curly quotes and extra spaces as equal", () => {
    expect(normalizeQueryForComparison("in:inbox  “from:x@example.com”")).toBe(
      normalizeQueryForComparison('in:inbox "from:x@example.com"'),
    );
  });

  describe("ITI-008: search controls are scoped to the search landmark", () => {
    it('findSearchBox ignores Chat/Spaces search inputs outside [role="search"]', () => {
      document.body.innerHTML = "";
      // A Chat/Spaces search control elsewhere in the DOM, NOT inside a
      // [role="search"] landmark or header.
      const chatSearch = document.createElement("input");
      chatSearch.type = "text";
      chatSearch.setAttribute("aria-label", "Search in Chat");
      document.body.append(chatSearch);

      installGmailSearchDom(() => {
        /* no-op submit */
      });
      const box = findSearchBox();
      expect(box).not.toBeNull();
      expect(box?.getAttribute("aria-label")).toBe("Suche");
      expect(box).not.toBe(chatSearch);
    });

    it('findSearchSubmitButton ignores search buttons outside [role="search"]', () => {
      document.body.innerHTML = "";
      // A decoy "Search" button that belongs to a different surface.
      const decoy = document.createElement("button");
      decoy.setAttribute("aria-label", "Search Chat");
      decoy.textContent = "Search Chat";
      document.body.append(decoy);

      installGmailSearchDom(() => {
        /* no-op submit */
      });
      const btn = findSearchSubmitButton();
      expect(btn).not.toBeNull();
      expect(btn).not.toBe(decoy);
    });

    it("findSearchBox falls back to a header input when no landmark exists", () => {
      document.body.innerHTML = "";
      const header = document.createElement("header");
      const box = document.createElement("input");
      box.type = "text";
      box.setAttribute("aria-label", "Search mail");
      header.append(box);
      document.body.append(header);
      expect(findSearchBox()).toBe(box);
    });

    it("returns null when no search input is present in any expected region", () => {
      document.body.innerHTML = "";
      // A search-labelled input floating in the body with no landmark/header.
      const stray = document.createElement("input");
      stray.type = "text";
      stray.setAttribute("aria-label", "Search");
      document.body.append(stray);
      expect(findSearchBox()).toBeNull();
      expect(findSearchSubmitButton()).toBeNull();
    });
  });
});

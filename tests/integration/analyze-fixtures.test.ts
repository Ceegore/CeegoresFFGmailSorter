import { beforeEach, describe, expect, it } from "vitest";
import { loadFixture, setRoute } from "./fixture-loader";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";
import { detectCurrentView, detectShell, findMessageListElement } from "@/gmail/dom-detectors";
import { toAppError } from "@/shared/errors";

/** Mutable location stub the detectors read through window.location. */
function installGmailLocation(hash = "#inbox"): void {
  const state: { hash: string; pathname: string; hostname: string; search: string; href: string } =
    {
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
  // Make setRoute mutate this stub.
  (window as unknown as { __gisoSetRoute?: (h: string) => void }).__gisoSetRoute = (h: string) => {
    state.hash = h;
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("analyzeCurrentInbox against synthetic DE inbox fixture", () => {
  beforeEach(() => {
    installGmailLocation("#inbox");
    loadFixture("gmail-de-inbox-light.html");
    setRoute("#inbox");
  });

  it("detects shell, inbox view, message list", () => {
    expect(detectShell().ok).toBe(true);
    const view = detectCurrentView();
    expect(view.value?.isInboxLike).toBe(true);
    expect(view.value?.isSearchActive).toBe(false);
    expect(findMessageListElement()).not.toBeNull();
  });

  it("groups recurring senders and drops singletons", async () => {
    const result = await analyzeCurrentInbox(new AbortController().signal);
    expect(result.rowCount).toBe(6);
    const emails = result.groups.map((g) => g.normalizedEmail).sort();
    expect(emails).toEqual(["billing@example.org", "newsletter-alpha@example.com"]);
    const alpha = result.groups.find((g) => g.normalizedEmail === "newsletter-alpha@example.com");
    expect(alpha?.visibleEntryCount).toBe(3);
    expect(alpha?.confidence).toBe("high");
    expect(result.groups.find((g) => g.normalizedEmail === "single@example.net")).toBeUndefined();
  });

  it("honors resolved + unresolved = rowCount", async () => {
    const result = await analyzeCurrentInbox(new AbortController().signal);
    expect(result.resolvedCount + result.unresolvedCount).toBe(result.rowCount);
  });

  it("aborts cleanly when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(analyzeCurrentInbox(ac.signal)).rejects.toThrow();
  });
});

describe("view detection blocks analysis outside inbox", () => {
  beforeEach(() => {
    installGmailLocation("#inbox");
    loadFixture("gmail-de-inbox-light.html");
  });

  it("rejects an active search view", () => {
    setRoute("#search/from:x");
    const view = detectCurrentView();
    expect(view.value?.isSearchActive).toBe(true);
    expect(view.value?.isInboxLike).toBe(false);
  });

  it("rejects a non-gmail host", () => {
    installGmailLocation("#inbox");
    // Override hostname to a non-gmail host.
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        hostname: "example.com",
        pathname: "/",
        hash: "#inbox",
        search: "",
        href: "https://example.com/",
      },
    });
    expect(detectShell().ok).toBe(false);
  });
});

describe("ITI-014: analysis is rejected when Gmail has an active selection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installGmailLocation("#inbox");
    loadFixture("gmail-de-inbox-light.html");
    setRoute("#inbox");
  });

  it("rejects analysis when a row checkbox is checked", async () => {
    // CUR-018: the selection guard is now scoped to [role="main"], which is
    // where Gmail renders its message-list checkboxes. Append the checkbox
    // inside the main mail surface so the guard correctly trips.
    const checked = document.createElement("div");
    checked.setAttribute("role", "checkbox");
    checked.setAttribute("aria-checked", "true");
    document.querySelector('[role="main"]')?.append(checked);
    const err = await analyzeCurrentInbox(new AbortController().signal).catch((e: unknown) => e);
    expect(toAppError(err).code).toBe("GISO-SELECTION-CONFLICT-001");
  });

  it("rejects analysis when a row checkbox is in the mixed (indeterminate) state", async () => {
    // CUR-018: scoped to [role="main"].
    const mixed = document.createElement("div");
    mixed.setAttribute("role", "checkbox");
    mixed.setAttribute("aria-checked", "mixed");
    document.querySelector('[role="main"]')?.append(mixed);
    const err = await analyzeCurrentInbox(new AbortController().signal).catch((e: unknown) => e);
    expect(toAppError(err).code).toBe("GISO-SELECTION-CONFLICT-001");
  });

  it("ignores selections rendered inside the extension's own overlay root", async () => {
    const root = document.createElement("div");
    root.id = "giso-extension-root";
    const checked = document.createElement("div");
    checked.setAttribute("role", "checkbox");
    checked.setAttribute("aria-checked", "true");
    root.append(checked);
    document.body.append(root);
    const result = await analyzeCurrentInbox(new AbortController().signal);
    expect(result.rowCount).toBeGreaterThan(0);
  });
});

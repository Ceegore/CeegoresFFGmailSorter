import { beforeEach, describe, expect, it } from "vitest";
import { loadFixture, setRoute } from "./fixture-loader";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";
import { detectCurrentView, detectShell, findMessageListElement } from "@/gmail/dom-detectors";
/** Mutable location stub the detectors read through window.location. */
function installGmailLocation(hash = "#inbox") {
  const state = {
    hash,
    pathname: "/mail/u/0/",
    hostname: "mail.google.com",
    search: "",
    get href() {
      return `https://${state.hostname}${state.pathname}${state.hash}`;
    },
  };
  Object.defineProperty(window, "location", {
    writable: true,
    configurable: true,
    value: state,
  });
  // Make setRoute mutate this stub.
  window.__gisoSetRoute = (h) => {
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

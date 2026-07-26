// Selection controller tests (spec §54). Proves the page/global/single-page/
// manual-fallback logic and the deselect-rejection guard. All against synthetic
// jsdom DOM — no live Gmail.
import { beforeEach, describe, expect, it } from "vitest";
import {
  allMatchesSelected,
  findSelectAllMatchesControl,
  isSinglePageProof,
  selectCurrentPage,
  trySelectAllMatches,
} from "@/gmail/selection-controller";

beforeEach(() => {
  document.body.innerHTML = "";
});

function setupToolbarCheckbox(checked = false): HTMLInputElement {
  const toolbar = document.createElement("div");
  toolbar.setAttribute("role", "toolbar");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  toolbar.append(cb);
  document.body.append(toolbar);
  return cb;
}

describe("selectCurrentPage", () => {
  it("clicks the toolbar checkbox and confirms selection", async () => {
    const cb = setupToolbarCheckbox(false);
    cb.addEventListener("click", () => {
      cb.checked = true;
    });
    const ok = await selectCurrentPage(new AbortController().signal, { timeoutMs: 1000 });
    expect(ok).toBe(true);
    expect(cb.checked).toBe(true);
  });

  it("rejects when no toolbar checkbox exists", async () => {
    await expect(
      selectCurrentPage(new AbortController().signal, { timeoutMs: 400 }),
    ).rejects.toMatchObject({
      app: { code: "GISO-SELECT-PAGE-001" },
    });
  });

  it("rejects a per-row checkbox (only toolbar scope)", async () => {
    const row = document.createElement("tr");
    row.setAttribute("role", "row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    row.append(cb);
    document.body.append(row);
    await expect(
      selectCurrentPage(new AbortController().signal, { timeoutMs: 400 }),
    ).rejects.toMatchObject({
      app: { code: "GISO-SELECT-PAGE-001" },
    });
  });

  it("aborts cleanly", async () => {
    const cb = setupToolbarCheckbox(false);
    // Prevent the default toggle so the postcondition never confirms and the
    // wait loop runs until the abort propagates.
    cb.addEventListener("click", (e) => {
      e.preventDefault();
    });
    const ac = new AbortController();
    const p = selectCurrentPage(ac.signal, { timeoutMs: 5000 });
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});

describe("trySelectAllMatches", () => {
  it("clicks the select-all-matches control and confirms", async () => {
    const banner = document.createElement("button");
    banner.textContent = "Alle Unterhaltungen auswählen, die dieser Suche entsprechen";
    document.body.append(banner);
    banner.addEventListener("click", () => {
      const ack = document.createElement("div");
      ack.textContent = "Alle 5 Unterhaltungen ausgewählt";
      document.body.append(ack);
    });
    const outcome = await trySelectAllMatches(new AbortController().signal, { waitMs: 2000 });
    expect(outcome).toBe("selected");
  });

  it("returns manual-required for a deselect control (never clicks it)", async () => {
    const banner = document.createElement("button");
    banner.textContent = "Auswahl aufheben";
    document.body.append(banner);
    const outcome = await trySelectAllMatches(new AbortController().signal, { waitMs: 600 });
    expect(outcome).toBe("manual-required");
  });

  it("proves single-page when all rows selected and no next control", async () => {
    const list = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    row.append(cb);
    list.append(row);
    document.body.append(list);
    const outcome = await trySelectAllMatches(new AbortController().signal, { waitMs: 600 });
    expect(outcome).toBe("single-page-proven");
  });

  it("returns manual-required when nothing is provable", async () => {
    // Empty page, no controls.
    const outcome = await trySelectAllMatches(new AbortController().signal, { waitMs: 400 });
    expect(outcome).toBe("manual-required");
  });
});

describe("single-page proof and helpers", () => {
  it("isSinglePageProof: next button present => false even if rows selected", () => {
    const list = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    row.append(cb);
    list.append(row);
    document.body.append(list);
    const next = document.createElement("button");
    next.textContent = "Ältere";
    document.body.append(next);
    expect(isSinglePageProof()).toBe(false);
  });

  it("findSelectAllMatchesControl matches EN pattern", () => {
    const btn = document.createElement("button");
    btn.textContent = "Select all conversations that match this search";
    document.body.append(btn);
    expect(findSelectAllMatchesControl()).toBe(btn);
  });

  it("allMatchesSelected detects explicit all-selected text", () => {
    const div = document.createElement("div");
    div.textContent = "All 12 conversations selected";
    document.body.append(div);
    expect(allMatchesSelected()).toBe(true);
  });
});

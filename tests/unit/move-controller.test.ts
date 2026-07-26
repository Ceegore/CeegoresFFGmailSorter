// Move-menu controller tests (spec §55). Proves: toolbar move button wins,
// negative signals rejected, menu detection needs >=2 markers, retry behavior,
// abort safety. Against synthetic jsdom DOM.
import { beforeEach, describe, expect, it } from "vitest";
import { findMoveControl, findMoveMenu, openMoveMenu } from "@/gmail/move-controller";

beforeEach(() => {
  document.body.innerHTML = "";
});

function toolbarButton(label: string): HTMLButtonElement {
  const toolbar = document.createElement("div");
  toolbar.setAttribute("role", "toolbar");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  toolbar.append(btn);
  document.body.append(toolbar);
  return btn;
}

describe("findMoveControl", () => {
  it("finds the DE 'Verschieben nach' toolbar button", () => {
    const btn = toolbarButton("Verschieben nach");
    expect(findMoveControl()).toBe(btn);
  });
  it("finds the EN 'Move to' toolbar button", () => {
    const btn = toolbarButton("Move to");
    expect(findMoveControl()).toBe(btn);
  });
  it("rejects a per-row move-like button (only toolbar scope)", () => {
    const row = document.createElement("tr");
    row.setAttribute("role", "row");
    const btn = document.createElement("button");
    btn.textContent = "Verschieben nach";
    row.append(btn);
    document.body.append(row);
    expect(findMoveControl()).toBeNull();
  });
  it("rejects negative signals (Label/Archive/Delete/More)", () => {
    toolbarButton("Label");
    toolbarButton("Archivieren");
    toolbarButton("Löschen");
    toolbarButton("Mehr");
    expect(findMoveControl()).toBeNull();
  });
});

describe("findMoveMenu", () => {
  it("detects a dialog with a label option and a search field (>=2 markers)", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const search = document.createElement("input");
    search.type = "text";
    const opt = document.createElement("button");
    opt.textContent = "Work";
    dialog.append(search, opt);
    document.body.append(dialog);
    expect(findMoveMenu()).toBe(dialog);
  });
  it("rejects a menu with only one marker", () => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu); // no options, no search, no move text
    expect(findMoveMenu()).toBeNull();
  });
});

describe("openMoveMenu", () => {
  it("clicks the move button and detects the opened menu", async () => {
    const btn = toolbarButton("Verschieben nach");
    btn.addEventListener("click", () => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      const search = document.createElement("input");
      search.type = "text";
      const label = document.createElement("button"); // a label option (2nd marker)
      label.textContent = "Work";
      dialog.append(search, label);
      document.body.append(dialog);
    });
    const menu = await openMoveMenu(new AbortController().signal, { timeoutMs: 1500 });
    expect(menu.getAttribute("role")).toBe("dialog");
  });

  it("throws GISO-MOVE-001 when no move button exists", async () => {
    await expect(
      openMoveMenu(new AbortController().signal, { timeoutMs: 600 }),
    ).rejects.toMatchObject({
      app: { code: "GISO-MOVE-001" },
    });
  });

  it("throws GISO-MOVE-002 when the button never opens a menu", async () => {
    toolbarButton("Verschieben nach"); // click does nothing
    await expect(
      openMoveMenu(new AbortController().signal, { timeoutMs: 600 }),
    ).rejects.toMatchObject({
      app: { code: "GISO-MOVE-002" },
    });
  });

  it("aborts cleanly", async () => {
    const btn = toolbarButton("Verschieben nach");
    btn.addEventListener("click", () => {
      /* never opens */
    });
    const ac = new AbortController();
    const p = openMoveMenu(ac.signal, { timeoutMs: 5000 });
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});

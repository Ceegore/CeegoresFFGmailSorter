import { describe, expect, it } from "vitest";
import { renderBrandCredit } from "@/ui/brand-credit";

describe("brand credit", () => {
  it("renders exactly the locked non-interactive text", () => {
    const credit = renderBrandCredit();
    expect(credit.textContent).toBe("made by Ceegore");
    expect(credit.dataset["testid"]).toBe("brand-credit");
    expect(credit.querySelector("a")).toBeNull();
    expect(credit.tagName).toBe("P");
  });
  it("has no click listeners and is not focusable as a link", () => {
    const credit = renderBrandCredit();
    expect(credit.getAttribute("role")).toBeNull();
    expect(credit.tabIndex).toBe(-1);
  });
});

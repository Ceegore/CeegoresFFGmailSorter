import { describe, expect, it } from "vitest";
import { ensureOverlayHost } from "@/ui/overlay-host";
describe("ensureOverlayHost", () => {
  it("creates exactly one host with an open shadow root", () => {
    const { host, shadow } = ensureOverlayHost();
    expect(host.id).toBe("giso-extension-root");
    expect(host.shadowRoot).not.toBeNull();
    expect(shadow).toBe(host.shadowRoot);
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
  });
  it("returns the same host on repeated calls (no duplicates)", () => {
    const first = ensureOverlayHost();
    const second = ensureOverlayHost();
    expect(second.host).toBe(first.host);
    expect(document.querySelectorAll("#giso-extension-root")).toHaveLength(1);
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
  });
  it("replaces a stale host element lacking a shadow root", () => {
    const stale = document.createElement("div");
    stale.id = "giso-extension-root";
    document.documentElement.append(stale);
    const { host } = ensureOverlayHost();
    expect(host).not.toBe(stale);
    expect(host.shadowRoot).not.toBeNull();
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
  });
});

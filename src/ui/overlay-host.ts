import { OVERLAY_ROOT_ID } from "@/shared/constants";

export function ensureOverlayHost(): { host: HTMLDivElement; shadow: ShadowRoot } {
  const existing = document.getElementById(OVERLAY_ROOT_ID);
  if (existing instanceof HTMLDivElement && existing.shadowRoot) {
    return { host: existing, shadow: existing.shadowRoot };
  }
  existing?.remove();
  const host = document.createElement("div");
  host.id = OVERLAY_ROOT_ID;
  host.style.position = "fixed";
  host.style.inset = "0 auto auto 0";
  host.style.zIndex = "2147483000";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.append(host);
  return { host, shadow };
}

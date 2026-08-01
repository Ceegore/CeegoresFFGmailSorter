import { GMAIL_HOME_URL } from "@/shared/constants";
import { isContentResponse, type BackgroundToContentMessage } from "@/shared/messages";

browser.action.onClicked.addListener((tab) => {
  void handleActionClick(tab);
});

// CUR-035: parse the URL rather than relying on a string prefix so look-alike
// hosts (e.g. https://mail.google.com.evil.example/) and non-https schemes are
// rejected. Only an exact mail.google.com host over https qualifies as a Gmail
// tab.
function isGmailTab(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "mail.google.com";
  } catch {
    return false;
  }
}

/**
 * CUR-034: clear the transient toolbar-action badge. Extracted as an async
 * function so the setTimeout callback can stay void (avoiding the
 * no-misused-promises lint on an async arrow passed to setTimeout). Best-effort:
 * the tab may be gone by the time the 3s timer fires.
 */
async function clearBadge(tabId: number): Promise<void> {
  try {
    await browser.action.setBadgeText({ text: "", tabId });
  } catch {
    /* tab may be gone */
  }
}

async function handleActionClick(tab: {
  readonly id?: number | undefined;
  readonly url?: string | undefined;
}): Promise<void> {
  if (typeof tab.id !== "number") return;
  // Capture into a const so the narrowed type is visible inside closures
  // (setTimeout below) — accessing tab.id again is `number | undefined`.
  const tabId = tab.id;
  // BUG-014: only message the content script when the active tab is Gmail.
  // Otherwise open Gmail in a new tab directly, skipping the sendMessage
  // attempt (which would fail/throw on non-Gmail pages).
  if (!isGmailTab(tab.url)) {
    await browser.tabs.create({ url: GMAIL_HOME_URL });
    return;
  }
  const message: BackgroundToContentMessage = { type: "TOGGLE_OVERLAY" };

  let rawResponse: unknown;
  try {
    rawResponse = await browser.tabs.sendMessage(tabId, message);
  } catch {
    // ITI-025: don't open a duplicate Gmail tab if the active tab IS Gmail but
    // the content script isn't ready yet (transient injection failure / a
    // Gmail tab that finished loading after the script check). The user can
    // retry by clicking again; opening a second Gmail tab is worse.
    if (isGmailTab(tab.url)) {
      console.warn(
        "Inbox Sender Organizer: content script not ready on this Gmail tab. Click again to retry.",
      );
      // CUR-034: a console-only warning is invisible to the user. Surface a
      // transient badge on the toolbar action so the click is not perceived as
      // a silent no-op; it clears after 3 seconds. Each call is best-effort —
      // the tab may be gone by the time the timer fires.
      try {
        await browser.action.setBadgeText({ text: "!", tabId });
        await browser.action.setBadgeBackgroundColor({ color: "#b3261e", tabId });
      } catch {
        /* badge API may be unavailable; nothing more to do */
      }
      window.setTimeout(() => {
        void clearBadge(tabId);
      }, 3000);
      return;
    }
    await browser.tabs.create({ url: GMAIL_HOME_URL });
    return;
  }

  if (!isContentResponse(rawResponse)) {
    console.warn("Inbox Sender Organizer received an invalid content response.");
    return;
  }
  if (!rawResponse.ok) {
    console.warn(
      "Inbox Sender Organizer could not toggle the existing Gmail overlay:",
      rawResponse.error ?? "unknown error",
    );
  }
}

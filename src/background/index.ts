import { GMAIL_HOME_URL } from "@/shared/constants";
import { isContentResponse, type BackgroundToContentMessage } from "@/shared/messages";

browser.action.onClicked.addListener((tab) => {
  void handleActionClick(tab);
});

async function handleActionClick(tab: {
  readonly id?: number | undefined;
  readonly url?: string | undefined;
}): Promise<void> {
  if (typeof tab.id !== "number") return;
  // BUG-014: only message the content script when the active tab is Gmail.
  // Otherwise open Gmail in a new tab directly, skipping the sendMessage
  // attempt (which would fail/throw on non-Gmail pages).
  if (!tab.url?.startsWith("https://mail.google.com")) {
    await browser.tabs.create({ url: GMAIL_HOME_URL });
    return;
  }
  const message: BackgroundToContentMessage = { type: "TOGGLE_OVERLAY" };

  let rawResponse: unknown;
  try {
    rawResponse = await browser.tabs.sendMessage(tab.id, message);
  } catch {
    // ITI-025: don't open a duplicate Gmail tab if the active tab IS Gmail but
    // the content script isn't ready yet (transient injection failure / a
    // Gmail tab that finished loading after the script check). The user can
    // retry by clicking again; opening a second Gmail tab is worse.
    if (tab.url.startsWith("https://mail.google.com")) {
      console.warn(
        "Inbox Sender Organizer: content script not ready on this Gmail tab. Click again to retry.",
      );
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

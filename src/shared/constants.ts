export const GMAIL_HOME_URL = "https://mail.google.com/" as const;
export const OVERLAY_ROOT_ID = "giso-extension-root" as const;
export const BRAND_CREDIT = "made by Ceegore" as const;

// BUG-061: the documented adapter version must exist as a real constant. Used
// in diagnostic exports, release metadata, and fixture metadata.
export const GMAIL_ADAPTER_VERSION = "2026.07.1" as const;

/**
 * SAFE MODE (Phase A of the bug-fix plan, report §11).
 *
 * While true, the add-on performs ZERO automatic SELECTION, SELECT-ALL,
 * MOVE-MENU, or COMPLETION clicks. The verified search itself IS submitted
 * automatically (it is read-only and cannot move or delete mail); after it
 * completes the add-on stops and surfaces the query for the user to perform
 * selection and move manually. This neutralizes every "wrong mass action"
 * risk identified in the audit (BUG-002/006/007/014/035/037/043) until
 * Phases B–D close the underlying click-safety defects.
 *
 * Flipping this back to false re-enables the automated selection/move path —
 * do so only after those phases pass their acceptance tests.
 */
export const SAFE_MODE = true as const;

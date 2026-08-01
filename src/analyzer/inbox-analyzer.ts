// Inbox analyzer (spec §27.1, §50.3). Read-only: it never clicks. It detects
// the shell/view, collects rows, extracts senders, groups them, and returns
// an AnalysisResult with all invariants enforced. Hovercard fallback is NOT
// used in V1's default path (kept attribute-driven for reviewability).
import { assertNotAborted } from "@/shared/abort";
import { appError, throwAppError } from "@/shared/errors";
import { delay } from "@/shared/time";
import {
  collectMessageRows,
  detectAccountSlot,
  detectCurrentView,
  detectShell,
  findMessageListElement,
} from "@/gmail/dom-detectors";
import { extractSenderFromRow } from "@/analyzer/sender-extractor";
import { fingerprintRow } from "@/analyzer/fingerprint";
import { compareByCountThenName, groupResolvedSenders } from "@/analyzer/grouping";
import type { AnalyzedEntry, AnalysisResult, SenderIdentity } from "@/shared/types";

// H-2: Use a monotonically increasing counter for the run id instead of
// Date.now(). Two analyses started within the same millisecond would otherwise
// share a run id, which collides the weak fingerprint namespace (the run id is
// mixed into row fingerprints) and can mask duplicate-row detection.
let analysisRunCounter = 0;

/**
 * ITI-013: a simple fingerprint of the message list's children used only to
 * detect DOM churn during the stability window. This is intentionally a
 * separate, lighter fingerprint than the global listFingerprint used elsewhere —
 * it scopes to a single list element so unrelated DOM changes don't reset the
 * window. CUR-015: in addition to the row count, the per-row thread ids are
 * included so a same-length DOM swap (e.g. Gmail replacing one thread with
 * another during virtualization) is detected and resets the window.
 */
function listFingerprintForStability(list: HTMLElement): string {
  const rows = list.querySelectorAll<HTMLElement>('[role="listitem"], tr[role="row"]');
  const ids: string[] = [];
  for (const row of rows) {
    const id =
      row.getAttribute("data-thread-id") ??
      row.getAttribute("data-legacy-thread-id") ??
      row.getAttribute("id");
    ids.push(id ?? "?");
  }
  return `count=${String(rows.length)};ids=${ids.join(",")}`;
}

// Async to match the controller's effect contract and to allow the stability
// window (and future budgeted hovercard resolution, spec §14.3) to await.
export async function analyzeCurrentInbox(signal: AbortSignal): Promise<AnalysisResult> {
  assertNotAborted(signal);
  const startedAt = Date.now();
  const analysisRunId = `run-${String(++analysisRunCounter)}`;

  const shell = detectShell();
  if (!shell.ok || !shell.value) {
    throwAppError(appError("GISO-SHELL-001", "gmailNotReady", "shell not detected", true));
  }
  const shellValue = shell.value;
  assertNotAborted(signal);

  const view = detectCurrentView();
  if (!view.ok || !view.value) {
    throwAppError(appError("GISO-VIEW-NOT-INBOX-001", "notInbox", "view not detected", true));
  }
  const viewValue = view.value;
  if (!viewValue.isInboxLike || viewValue.isSearchActive) {
    throwAppError(appError("GISO-VIEW-NOT-INBOX-001", "notInbox", "not an inbox view", true));
  }

  // ITI-014: reject analysis if Gmail already has an active selection. The spec
  // requires no active Gmail selection before analysis/search so that the
  // analyzer's read-only snapshot is not confused with a user's in-progress
  // selection. Selections rendered by this extension's own overlay are exempt.
  // CUR-018: scope to [role="main"] so checkboxes outside the mail surface (the
  // overlay, account/settings menus, chat, etc.) do not falsely trip the guard.
  // Include native input[type=checkbox]:checked so legacy markup is covered too.
  const existingSelection = document.querySelector(
    '[role="main"] [role="checkbox"][aria-checked="true"], [role="main"] [role="checkbox"][aria-checked="mixed"], [role="main"] input[type="checkbox"]:checked',
  );
  if (existingSelection && !existingSelection.closest("#giso-extension-root")) {
    throwAppError(
      appError(
        "GISO-SELECTION-CONFLICT-001",
        "unsafeState",
        "Gmail has an active selection; clear it before analyzing",
        true,
      ),
    );
  }

  // CUR-017: declare with `let` so a detached/replaced list can be re-resolved
  // after the stability wait.
  let list = findMessageListElement();
  if (!list) {
    throwAppError(appError("GISO-LIST-001", "noRows", "message list not found", true));
  }

  // ITI-013: wait for a 250ms DOM stability window before scanning. The spec
  // requires the list to be stable before we snapshot rows, otherwise transient
  // Gmail rendering (lazy rows, virtualized reflow) can produce a partial or
  // reordered result. We poll a lightweight child-count fingerprint and reset
  // the window whenever it changes.
  // CUR-016: bound the wait with a 10-second deadline so a churn-heavy DOM
  // cannot hang analysis forever. If the deadline passes without stability we
  // proceed anyway (the scan may be less accurate but won't block the user,
  // who now also has a Cancel button on the analyzing view).
  const listForStability = list;
  const deadline = performance.now() + 10_000;
  let lastFingerprint = listFingerprintForStability(listForStability);
  let stableSince = performance.now();
  while (performance.now() - stableSince < 250 && performance.now() < deadline) {
    assertNotAborted(signal);
    // C-2: use the shared delay(), whose abort listener is removed on both the
    // timeout and abort paths. The previous hand-rolled Promise leaked its
    // listener on the normal (timeout) path for the signal's lifetime.
    await delay(50, signal);
    const currentFingerprint = listFingerprintForStability(listForStability);
    if (currentFingerprint !== lastFingerprint) {
      lastFingerprint = currentFingerprint;
      stableSince = performance.now();
    }
  }
  assertNotAborted(signal);

  // CUR-017: Gmail may have replaced the list node during the stability window.
  // If the captured node is now detached, re-resolve to the current list and
  // scan that instead of a stale detached subtree.
  if (!list.isConnected) {
    const freshList = findMessageListElement();
    if (!freshList) {
      throwAppError(
        appError("GISO-LIST-001", "noRows", "message list detached during analysis", true),
      );
    }
    list = freshList;
  }

  const rawRows = collectMessageRows(list);
  if (rawRows.length === 0) {
    throwAppError(appError("GISO-ROWS-001", "noRows", "no message rows", true));
  }

  const entries: AnalyzedEntry[] = [];
  const seenFingerprints = new Set<string>();
  let duplicateCount = 0;
  let weakFingerprintCount = 0;

  for (let index = 0; index < rawRows.length; index += 1) {
    assertNotAborted(signal);
    if (index % 50 === 0 && index > 0) {
      // ITI-039: yield periodically so the row scan can be interrupted by
      // abort and so long lists do not monopolize the main thread. Without a
      // yield point the synchronous loop runs to completion regardless of the
      // AbortSignal, and large inboxes can block UI updates.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    const row = rawRows[index];
    if (!row) continue;
    const fingerprint = fingerprintRow(row, index, analysisRunId);
    if (fingerprint.strength === "weak") weakFingerprintCount += 1;
    if (seenFingerprints.has(fingerprint.value)) {
      duplicateCount += 1;
      continue;
    }
    seenFingerprints.add(fingerprint.value);
    const sender: SenderIdentity = extractSenderFromRow(row);
    entries.push({ fingerprint: fingerprint.value, sender, rowIndex: index });
  }

  const groups = groupResolvedSenders(entries).sort(compareByCountThenName);
  const resolvedCount = entries.filter(
    (e) => e.sender.confidence === "high" || e.sender.confidence === "medium",
  ).length;
  const unresolvedEntries = entries.filter(
    (e) => e.sender.confidence === "low" || e.sender.confidence === "unresolved",
  );

  const slot = viewValue.accountSlot ?? detectAccountSlot() ?? null;
  const routeFingerprint = `view=${viewValue.viewClass};slot=${slot === null ? "none" : String(slot)}`;

  const result: AnalysisResult = {
    startedAt,
    completedAt: Date.now(),
    sourceRoute: {
      accountSlot: slot,
      view: viewValue.viewClass,
      fingerprint: routeFingerprint,
    },
    rowCount: entries.length,
    resolvedCount,
    unresolvedCount: unresolvedEntries.length,
    duplicateCount,
    weakFingerprintCount,
    groups,
    unresolvedEntries,
  };
  assertResultInvariants(result);
  // shellValue referenced to keep the narrow type alive for future locale work.
  void shellValue;
  return result;
}

function assertResultInvariants(result: AnalysisResult): void {
  if (result.resolvedCount + result.unresolvedCount !== result.rowCount) {
    throw new Error("analysis invariant violated: resolved + unresolved != row count");
  }
  for (const group of result.groups) {
    if (group.visibleEntryCount < 2) {
      throw new Error("analysis invariant violated: group with count < 2");
    }
  }
  // No fingerprint may appear in two groups.
  const all = new Set<string>();
  for (const group of result.groups) {
    for (const fp of group.sourceFingerprints) {
      if (all.has(fp)) throw new Error("analysis invariant violated: shared fingerprint");
      all.add(fp);
    }
  }
  // No address in two groups.
  const emails = new Set<string>();
  for (const group of result.groups) {
    if (emails.has(group.normalizedEmail)) {
      throw new Error("analysis invariant violated: shared email");
    }
    emails.add(group.normalizedEmail);
  }
  if (result.completedAt < result.startedAt) {
    throw new Error("analysis invariant violated: completedAt < startedAt");
  }
}

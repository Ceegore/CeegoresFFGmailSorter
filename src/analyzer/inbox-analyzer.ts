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
    if (id) {
      ids.push(id);
    } else {
      // MEDIUM-03: for rows without stable IDs, the previous code collapsed
      // every such row to a literal "?", so a same-count DOM swap of ID-less
      // rows (e.g. Gmail virtualization swapping one anonymous row for another
      // during the stability window) produced an identical fingerprint and was
      // NOT detected. Use a bounded hash of sender-relevant ATTRIBUTES only
      // (never subject/content/snippet, which would make the fingerprint too
      // brittle to transient text changes) so anonymous rows still contribute
      // a distinguishing token.
      const email =
        row.getAttribute("email") ?? row.querySelector("[email]")?.getAttribute("email") ?? "";
      const hover =
        row.getAttribute("data-hovercard-id") ??
        row.querySelector("[data-hovercard-id]")?.getAttribute("data-hovercard-id") ??
        "";
      // HIGH-03: compute a real bounded hash from sender-relevant attribute
      // VALUES (not just lengths). Two different senders with equal-length
      // addresses now produce different fingerprints.
      const hashInput = `${email}|${hover}`;
      let hash = 0;
      for (let i = 0; i < hashInput.length && i < 64; i++) {
        hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0;
      }
      ids.push(`h${String(hash)}`);
    }
  }
  return `count=${String(rows.length)};ids=${ids.join(",")}`;
}

/**
 * CUR-016/CUR-017: reusable, bounded DOM-stability wait. Polls the list's
 * lightweight child fingerprint and only returns success once the fingerprint
 * has remained unchanged for a continuous `stabilityMs` window. The wait is
 * always bounded by `deadlineMs` so a churn-heavy DOM cannot hang analysis. This
 * is used both for the initial pre-scan stability window and for the detached /
 * replacement-list re-stabilization, which previously had NO deadline and only
 * required 100ms (not the 250ms the spec mandates).
 *
 * Returns true if the list was stable for the full window, false if the deadline
 * expired first. Callers decide whether false is a hard failure or recoverable.
 */
async function waitForListStability(
  list: HTMLElement,
  signal: AbortSignal,
  stabilityMs: number,
  deadlineMs: number,
): Promise<boolean> {
  const deadline = performance.now() + deadlineMs;
  let lastFingerprint = listFingerprintForStability(list);
  let stableSince = performance.now();
  while (performance.now() - stableSince < stabilityMs && performance.now() < deadline) {
    assertNotAborted(signal);
    // C-2: use the shared delay(), whose abort listener is removed on both the
    // timeout and abort paths. The previous hand-rolled Promise leaked its
    // listener on the normal (timeout) path for the signal's lifetime.
    await delay(50, signal);
    const currentFingerprint = listFingerprintForStability(list);
    if (currentFingerprint !== lastFingerprint) {
      lastFingerprint = currentFingerprint;
      stableSince = performance.now();
    }
  }
  return performance.now() - stableSince >= stabilityMs;
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
  // reordered result. CUR-016: bound the wait with a 10-second deadline so a
  // churn-heavy DOM cannot hang analysis forever. Unlike the previous "proceed
  // anyway" behavior (which scanned an unstable snapshot and could silently
  // produce a partial / reordered result), we now fail safe: if the deadline
  // expired WITHOUT the DOM having been stable, throw a recoverable gmailNotReady
  // error so the user is never handed an analysis built on a still-mutating list.
  // The caller can retry; the user also has a Cancel button on the analyzing view.
  const listForStability = list;
  const achievedStability = await waitForListStability(listForStability, signal, 250, 10_000);
  assertNotAborted(signal);

  // CUR-016: fail safe. If the 10s deadline expired and the DOM never achieved
  // a continuous 250ms stability window, throw a recoverable error. Do NOT
  // attempt a weak re-verification (the previous code only took a single 50ms
  // sample and proceeded if it matched — but 50ms != the required 250ms, so it
  // could snapshot a list that was merely momentarily still between mutations).
  // Proceeding with an unstable snapshot produces silently wrong results.
  if (!achievedStability) {
    throwAppError(
      appError(
        "GISO-DOM-CHANGED-001",
        "gmailNotReady",
        "DOM did not stabilize within deadline",
        true,
      ),
    );
  }

  // CUR-017: Gmail may have replaced the list node during the stability window.
  // If the captured node is now detached, re-resolve to the current list and
  // scan that instead of a stale detached subtree. The previous code scanned the
  // fresh node immediately, but a freshly-attached list can still be streaming
  // rows in (the very reason the original node was replaced). Run a bounded
  // 250ms stability wait (5s deadline) on the new node — matching the initial
  // window's stability bar — so the snapshot reflects its final state, not a
  // transient partial render. CUR-016: if the replacement list also fails to
  // stabilize within its deadline, fail safe rather than snapshotting it.
  if (!list.isConnected) {
    const freshList = findMessageListElement();
    if (!freshList) {
      throwAppError(
        appError("GISO-LIST-001", "noRows", "message list detached during analysis", true),
      );
    }
    list = freshList;
    // CUR-017: re-stabilize on the fresh node before scanning.
    const replacementStable = await waitForListStability(list, signal, 250, 5_000);
    if (!replacementStable) {
      throwAppError(
        appError(
          "GISO-DOM-CHANGED-001",
          "gmailNotReady",
          "replacement message list did not stabilize within deadline",
          true,
        ),
      );
    }
  }

  // MEDIUM-01: after the replacement stability wait, the list may have been
  // replaced AGAIN by Gmail during that second wait. Scanning a now-detached
  // node would produce a stale snapshot. Verify `list.isConnected` once more;
  // if it detached, attempt ONE final bounded re-resolve. If that also fails,
  // throw safely rather than handing back an analysis of a detached subtree.
  if (!list.isConnected) {
    const finalList = findMessageListElement();
    if (!finalList?.isConnected) {
      throwAppError(
        appError(
          "GISO-LIST-001",
          "noRows",
          "message list repeatedly replaced during analysis",
          true,
        ),
      );
    }
    list = finalList;
    const finalStable = await waitForListStability(list, signal, 250, 3_000);
    if (!finalStable) {
      throwAppError(
        appError(
          "GISO-DOM-CHANGED-001",
          "gmailNotReady",
          "final replacement list did not stabilize",
          true,
        ),
      );
    }
  }

  // MEDIUM-02/HIGH-04/HIGH-05: capture the list fingerprint AND identity
  // immediately before collecting rows so we can detect a mid-scan DOM mutation
  // OR a whole-list replacement. After scanning, we verify not only that the
  // fingerprint is unchanged but also that the same list element is still the
  // primary list AND still connected. Gmail can detach the scanned list and
  // insert a new one while the analyzer yields — the old detached subtree's
  // fingerprint would remain unchanged, bypassing a pure fingerprint check.
  const preScanFingerprint = listFingerprintForStability(list);
  const scanList = list;
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

  // MEDIUM-02/HIGH-04/HIGH-05: after the scan loop, verify THREE things:
  // 1. The scanned list element is still the current primary list (identity).
  // 2. It is still connected (not detached by a Gmail re-render).
  // 3. Its fingerprint has not changed (no row mutation during scan).
  // A pure fingerprint check misses the case where Gmail detaches the old
  // list (fingerprint frozen) and inserts a new primary list — the analyzer
  // would silently return results from a stale detached subtree.
  if (!scanList.isConnected || findMessageListElement() !== scanList) {
    throwAppError(
      appError(
        "GISO-DOM-CHANGED-001",
        "gmailNotReady",
        "message list replaced during analysis scan",
        true,
      ),
    );
  }
  if (listFingerprintForStability(scanList) !== preScanFingerprint) {
    throwAppError(
      appError("GISO-DOM-CHANGED-001", "gmailNotReady", "DOM changed during analysis scan", true),
    );
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

// Inbox analyzer (spec §27.1, §50.3). Read-only: it never clicks. It detects
// the shell/view, collects rows, extracts senders, groups them, and returns
// an AnalysisResult with all invariants enforced. Hovercard fallback is NOT
// used in V1's default path (kept attribute-driven for reviewability).
import { assertNotAborted } from "@/shared/abort";
import { appError, throwAppError } from "@/shared/errors";
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

export interface AnalyzeResult {
  readonly result: AnalysisResult;
}

// Async to match the controller's effect contract and allow future
// budgeted hovercard resolution (spec §14.3) without an API change.
// eslint-disable-next-line @typescript-eslint/require-await
export async function analyzeCurrentInbox(signal: AbortSignal): Promise<AnalysisResult> {
  assertNotAborted(signal);
  const startedAt = Date.now();
  const analysisRunId = String(startedAt);

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

  const list = findMessageListElement();
  if (!list) {
    throwAppError(appError("GISO-LIST-001", "noRows", "message list not found", true));
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

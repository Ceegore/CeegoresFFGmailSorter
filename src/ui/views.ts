// All overlay view bodies. One dispatcher selects the view from workflow state;
// each view is a pure function returning an iterable of DOM nodes. Runtime
// values are inserted with textContent only. data-testid hooks are stable so
// the mock-e2e suite can drive the UI.
import type { AppController } from "@/app/controller";
import { de } from "@/i18n/de";
import { deriveSteps } from "@/app/state-machine";
import { buildInboxSenderQuery } from "@/gmail/search-controller";
import type { AppState, SenderGroup } from "@/shared/types";

function button(
  testid: string,
  label: string,
  onClick: () => void,
  variant: "primary" | "default" | "danger" | "link" = "default",
  disabled = false,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    variant === "link"
      ? "giso-btn giso-btn--link"
      : `giso-btn${variant !== "default" ? ` giso-btn--${variant}` : ""}`;
  btn.dataset["testid"] = testid;
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function statusLine(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "giso-status";
  p.textContent = text;
  return p;
}

function errorBlock(messageKey: string, code: string | undefined): HTMLElement {
  const div = document.createElement("div");
  div.className = "giso-error";
  div.setAttribute("role", "alert");
  const msg = document.createElement("p");
  msg.textContent = messageKey;
  div.append(msg);
  if (code) {
    const c = document.createElement("span");
    c.className = "giso-error__code";
    c.textContent = `Diagnose: ${code}`;
    div.append(c);
  }
  return div;
}

export function* renderView(
  state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  switch (state.workflow) {
    case "IDLE":
      yield* idleView(state, controller);
      return;
    case "ANALYZING":
      yield* analyzingView(state);
      return;
    case "RESULTS_READY":
      yield* resultsView(state, controller);
      return;
    case "CONFIRM_SEARCH":
      yield* confirmSearchView(state, controller);
      return;
    case "SEARCH_READY_MANUAL":
      yield* manualWorkflowView(state, controller);
      return;
    case "SETTING_SEARCH":
    case "WAITING_SEARCH_RESULTS":
    case "SELECTING_PAGE":
    case "WAITING_SELECT_ALL":
    case "MANUAL_SELECT_ALL":
    case "OPENING_MOVE_MENU":
    case "WAITING_TARGET_SELECTION":
    case "VERIFYING_COMPLETION":
      yield* workflowView(state, controller);
      return;
    case "COMPLETED":
      yield* completedView(state, controller);
      return;
    case "ERROR":
      yield* errorView(state, controller);
      return;
    case "CANCELLED":
      yield* idleView(state, controller);
      return;
  }
}

function* idleView(
  _state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  yield statusLine(de.ready);
  const hint = document.createElement("p");
  hint.className = "giso-hint";
  hint.textContent = de.analysisHint;
  yield hint;
  const actions = document.createElement("div");
  actions.className = "giso-actions";
  actions.append(
    button(
      "giso-analyze",
      de.analyzeInbox,
      () => {
        void controller.analyze();
      },
      "primary",
    ),
    button("giso-close", de.close, () => {
      controller.cancel();
    }),
    button(
      "giso-diagnostics",
      de.diagnostics,
      () => {
        controller.resetSession();
      },
      "link",
    ),
  );
  yield actions;
}

function* analyzingView(state: AppState): Generator<HTMLElement, void, unknown> {
  const p = document.createElement("p");
  p.className = "giso-status";
  const spinner = document.createElement("span");
  spinner.className = "giso-spinner";
  spinner.setAttribute("aria-hidden", "true");
  p.append(spinner, de.analyzing);
  yield p;
  yield statusLine(state.diagnostics.at(-1)?.message ?? "");
}

function filterAndSort(groups: readonly SenderGroup[], state: AppState): readonly SenderGroup[] {
  const filter = state.filter.trim().toLowerCase();
  const visible = groups.filter(
    (g) =>
      g.status !== "ignored" &&
      (!filter ||
        g.primaryDisplayName.toLowerCase().includes(filter) ||
        g.normalizedEmail.toLowerCase().includes(filter)),
  );
  const sorted = [...visible];
  switch (state.sort) {
    case "name":
      sorted.sort((a, b) => a.primaryDisplayName.localeCompare(b.primaryDisplayName));
      break;
    case "address":
      sorted.sort((a, b) => a.normalizedEmail.localeCompare(b.normalizedEmail));
      break;
    case "count":
    default:
      sorted.sort(
        (a, b) =>
          b.visibleEntryCount - a.visibleEntryCount ||
          a.primaryDisplayName.localeCompare(b.primaryDisplayName),
      );
      break;
  }
  return sorted;
}

function* resultsView(
  state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  if (!state.analysis) {
    yield statusLine(de.ready);
    return;
  }
  yield statusLine(de.analysisComplete);

  const summary = document.createElement("p");
  summary.className = "giso-hint";
  summary.textContent = `${String(state.analysis.rowCount)} Einträge geprüft · ${String(
    state.analysis.groups.filter((g) => g.status !== "ignored").length,
  )} wiederkehrende Absender · ${String(state.analysis.unresolvedCount)} nicht eindeutig`;
  yield summary;

  // Toolbar: filter + sort
  const toolbar = document.createElement("div");
  toolbar.className = "giso-toolbar";
  const filterInput = document.createElement("input");
  filterInput.type = "search";
  filterInput.className = "giso-input";
  filterInput.dataset["testid"] = "giso-filter";
  filterInput.placeholder = de.filterPlaceholder;
  filterInput.value = state.filter;
  filterInput.addEventListener("input", () => {
    controller.setFilter(filterInput.value);
  });
  const sortSelect = document.createElement("select");
  sortSelect.className = "giso-select";
  sortSelect.dataset["testid"] = "giso-sort";
  for (const [value, label] of [
    ["count", de.sortFrequent],
    ["name", de.sortName],
    ["address", de.sortAddress],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (state.sort === value) opt.selected = true;
    sortSelect.append(opt);
  }
  sortSelect.addEventListener("change", () => {
    controller.setSort(sortSelect.value as AppState["sort"]);
  });
  toolbar.append(filterInput, sortSelect);
  yield toolbar;

  const list = document.createElement("ul");
  list.className = "giso-group-list";
  list.dataset["testid"] = "giso-group-list";
  const groups = filterAndSort(state.analysis.groups, state);
  if (groups.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = de.noGroups;
    list.append(empty);
  }
  for (const group of groups) list.append(renderGroup(group, controller));
  yield list;

  if (state.analysis.unresolvedEntries.length > 0) {
    yield* unresolvedSection(state);
  }
}

function renderGroup(group: SenderGroup, controller: AppController): HTMLLIElement {
  const li = document.createElement("li");
  li.className = `giso-group giso-group--${group.status}`;
  li.dataset["testid"] = "giso-group";
  li.dataset["groupId"] = group.id;
  const name = document.createElement("div");
  name.className = "giso-group__name";
  name.textContent = group.primaryDisplayName;
  const email = document.createElement("span");
  email.className = "giso-group__email";
  email.textContent = group.normalizedEmail;
  const badge = document.createElement("span");
  badge.className = "giso-group__badge";
  badge.textContent = `${String(group.visibleEntryCount)} ${de.entries}`;
  const actions = document.createElement("div");
  actions.className = "giso-actions";
  actions.style.marginTop = "8px";
  if (group.status === "ready") {
    actions.append(
      button(
        "giso-find-all",
        de.findAllInbox,
        () => {
          controller.selectGroup(group.id);
        },
        "primary",
      ),
      button(
        "giso-ignore",
        de.ignoreSession,
        () => {
          controller.ignoreGroup(group.id);
        },
        "link",
      ),
    );
  } else if (group.status === "done") {
    const done = document.createElement("p");
    done.className = "giso-status";
    done.textContent = de.senderProcessed;
    actions.append(done);
  } else if (group.status === "error" && group.lastErrorCode) {
    actions.append(errorBlock(group.lastErrorCode, group.lastErrorCode));
  }
  li.append(name, email, badge, actions);
  return li;
}

function* unresolvedSection(state: AppState): Generator<HTMLElement, void, unknown> {
  if (!state.analysis) return;
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = de.unresolvedSummary.replace(
    "{count}",
    String(state.analysis.unresolvedCount),
  );
  details.append(summary);
  const show = document.createElement("ul");
  show.style.marginTop = "6px";
  show.style.fontSize = "12px";
  show.style.color = "var(--giso-muted)";
  for (const entry of state.analysis.unresolvedEntries) {
    const li = document.createElement("li");
    const reason = entry.sender.diagnostics[0] ?? de.unresolvedConflict;
    li.textContent = `${entry.sender.displayName ?? entry.sender.rawEmail ?? de.unresolvedConflict} — ${reason}`;
    show.append(li);
  }
  details.append(show);
  yield details;
}

function* workflowView(
  state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  const group = activeGroup(state);
  if (group) {
    const name = document.createElement("p");
    name.className = "giso-status";
    name.textContent = `${group.primaryDisplayName} · ${group.normalizedEmail}`;
    yield name;
  }
  const steps = document.createElement("ol");
  steps.className = "giso-steps";
  steps.dataset["testid"] = "giso-steps";
  const labels = [
    de.stepSearch,
    de.stepSelectPage,
    de.stepSelectAll,
    de.stepOpenMove,
    de.stepChooseTarget,
  ];
  const stepIds = ["search", "select-page", "select-all", "open-move", "choose-target"] as const;
  const stepStates = deriveSteps(state.workflow);
  for (const [key, label] of labels.entries()) {
    const stepId = stepIds[key];
    if (!stepId) continue;
    const li = document.createElement("li");
    li.className = "giso-step";
    li.dataset["status"] = stepStates[stepId];
    li.textContent = label;
    steps.append(li);
  }
  yield steps;

  if (state.expectedQuery) {
    const query = document.createElement("p");
    query.className = "giso-query";
    query.textContent = state.expectedQuery;
    yield query;
  }

  if (state.workflow === "MANUAL_SELECT_ALL") {
    const help = document.createElement("p");
    help.className = "giso-hint";
    help.textContent = de.manualSelectInstruction;
    yield help;
    yield button(
      "giso-continue",
      de.continue,
      () => {
        void controller.confirmManualSelection();
      },
      "primary",
    );
  } else if (state.workflow === "WAITING_TARGET_SELECTION") {
    const help = document.createElement("p");
    help.className = "giso-hint";
    help.textContent = de.chooseTargetBody;
    yield help;
    yield button("giso-reopen", de.reopenMenu, () => {
      void controller.reopenMoveMenu();
    });
    yield button(
      "giso-done",
      de.done,
      () => {
        controller.confirmCompletion();
      },
      "primary",
    );
  } else if (state.error) {
    yield errorBlock(state.error.userMessageKey, state.error.code);
  }

  yield button(
    "giso-cancel",
    de.cancel,
    () => {
      controller.cancel();
    },
    "danger",
  );
}

function* completedView(
  state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  const group = activeGroup(state);
  const title = document.createElement("p");
  title.className = "giso-status";
  title.textContent = de.senderProcessed;
  yield title;
  const detail = document.createElement("p");
  detail.className = "giso-hint";
  detail.textContent = group
    ? `${group.primaryDisplayName} wurde als erledigt markiert.`
    : de.markDone;
  yield detail;
  const actions = document.createElement("div");
  actions.className = "giso-actions";
  actions.append(
    button(
      "giso-next",
      de.nextSender,
      () => {
        controller.returnToResults();
      },
      "primary",
    ),
    button("giso-results", de.resultList, () => {
      controller.returnToResults();
    }),
  );
  yield actions;
}

function* errorView(
  state: AppState,
  _controller: AppController,
): Generator<HTMLElement, void, unknown> {
  if (state.error) yield errorBlock(state.error.userMessageKey, state.error.code);
  yield button(
    "giso-back",
    de.back,
    () => {
      _controller.returnToResults();
    },
    "primary",
  );
}

function activeGroup(state: AppState): SenderGroup | undefined {
  if (!state.analysis || !state.activeGroupId) return undefined;
  return state.analysis.groups.find((g) => g.id === state.activeGroupId);
}

/**
 * Phase A safe-mode view. The verified search query is shown and copyable, and
 * the user is instructed to perform selection + move manually in Gmail. The
 * add-on performs NO automatic clicks in this state. The user marks the group
 * done once they have completed the move themselves.
 */
/**
 * BUG-001: dedicated CONFIRM_SEARCH view. Shows the sender, address, visible
 * entry count, the exact Gmail query, and the confirm-body hint. The only
 * primary action is "Suche starten" (confirmSearch); "Zurück" returns to
 * RESULTS_READY. No other group actions are visible or actionable here.
 */
function* confirmSearchView(
  state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  const group = activeGroup(state);
  if (!group) {
    yield statusLine(de.ready);
    return;
  }
  const title = document.createElement("p");
  title.className = "giso-status";
  title.textContent = de.confirmTitle;
  yield title;

  const body = document.createElement("p");
  body.className = "giso-hint";
  body.textContent = de.confirmBody;
  yield body;

  const fields = document.createElement("div");
  fields.className = "giso-meter";
  const sender = document.createElement("div");
  sender.textContent = `${de.sender}: ${group.primaryDisplayName}`;
  const address = document.createElement("div");
  address.textContent = `${de.address}: ${group.normalizedEmail}`;
  const matches = document.createElement("div");
  matches.textContent = `${de.visibleMatches}: ${String(group.visibleEntryCount)}`;
  fields.append(sender, address, matches);
  yield fields;

  const queryLabel = document.createElement("div");
  queryLabel.className = "giso-meter";
  queryLabel.textContent = `${de.searchQuery}:`;
  yield queryLabel;
  const query = document.createElement("p");
  query.className = "giso-query";
  query.dataset["testid"] = "giso-confirm-query";
  query.textContent = buildInboxSenderQuery(group.normalizedEmail);
  yield query;

  const actions = document.createElement("div");
  actions.className = "giso-actions";
  actions.append(
    button(
      "giso-confirm-search",
      de.startSearch,
      () => {
        void controller.confirmSearch();
      },
      "primary",
    ),
    button("giso-back", de.back, () => {
      controller.returnToResults();
    }),
  );
  yield actions;
}

function* manualWorkflowView(
  state: AppState,
  controller: AppController,
): Generator<HTMLElement, void, unknown> {
  const group = activeGroup(state);
  if (group) {
    const name = document.createElement("p");
    name.className = "giso-status";
    name.textContent = `${group.primaryDisplayName} · ${group.normalizedEmail}`;
    yield name;
  }
  const title = document.createElement("p");
  title.className = "giso-status";
  title.textContent = de.startSearch;
  yield title;

  if (state.expectedQuery) {
    const query = document.createElement("p");
    query.className = "giso-query";
    query.dataset["testid"] = "giso-query";
    query.textContent = state.expectedQuery;
    yield query;

    const copyBtn = button(
      "giso-copy-query",
      de.copyQuery,
      () => {
        void copyToClipboard(state.expectedQuery ?? "");
      },
      "link",
    );
    yield copyBtn;
  }

  const help = document.createElement("p");
  help.className = "giso-hint";
  help.textContent = de.manualWorkflowHint;
  yield help;

  const warning = document.createElement("p");
  warning.className = "giso-hint";
  warning.textContent = de.liveActionWarning;
  yield warning;

  const actions = document.createElement("div");
  actions.className = "giso-actions";
  actions.append(
    button(
      "giso-mark-done",
      de.markDone,
      () => {
        controller.confirmCompletion();
      },
      "primary",
    ),
    button("giso-back", de.back, () => {
      controller.returnToResults();
    }),
  );
  yield actions;
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be unavailable; the query text remains visible to copy manually */
  }
}

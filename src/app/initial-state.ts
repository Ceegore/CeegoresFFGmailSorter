import type { AppState } from "@/shared/types";

export const initialState: AppState = {
  overlayVisible: false,
  workflow: "IDLE",
  analysis: null,
  activeGroupId: null,
  expectedQuery: null,
  error: null,
  filter: "",
  sort: "count",
  diagnostics: [],
};

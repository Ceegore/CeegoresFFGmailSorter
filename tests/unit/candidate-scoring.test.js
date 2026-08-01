import { describe, expect, it } from "vitest";
import { scoreCandidate, selectUnambiguous } from "@/gmail/candidate-scoring";
describe("selectUnambiguous", () => {
  it("selects a single clear winner above threshold", () => {
    const a = document.createElement("button");
    const b = document.createElement("button");
    const candidates = [
      { element: a, score: 100, evidence: [] },
      { element: b, score: 50, evidence: [] },
    ];
    expect(selectUnambiguous(candidates, 90, 20)?.element).toBe(a);
  });
  it("rejects candidates whose margin is too small", () => {
    const a = document.createElement("button");
    const b = document.createElement("button");
    const candidates = [
      { element: a, score: 100, evidence: [] },
      { element: b, score: 90, evidence: [] },
    ];
    expect(selectUnambiguous(candidates, 90, 20)).toBeNull();
  });
  it("rejects a candidate below the minimum score", () => {
    const a = document.createElement("button");
    const candidates = [{ element: a, score: 89, evidence: [] }];
    expect(selectUnambiguous(candidates, 90, 20)).toBeNull();
  });
});
describe("scoreCandidate", () => {
  it("sums evidence from matching rules and ignores nulls", () => {
    const el = document.createElement("button");
    const scored = scoreCandidate(el, [
      () => ({ code: "role", score: 20, detail: "button" }),
      () => null,
      () => ({ code: "label", score: 35, detail: "Move to" }),
    ]);
    expect(scored.score).toBe(55);
    expect(scored.evidence).toHaveLength(2);
  });
});

import { describe, it, expect } from "vitest";
import { AkinatorEngine, likelihood } from "./engine";

describe("AkinatorEngine", () => {
  it("clamps likelihood between 0.05 and 0.95", () => {
    expect(likelihood(1, 1)).toBe(0.95);
    expect(likelihood(-1, 1)).toBe(0.05);
    expect(likelihood(0, 1)).toBe(0.5);
  });

  it("undo restores previous probabilities exactly", () => {
    const e = new AkinatorEngine();
    const before = [...e.probs];
    e.answer("synth", 1);
    e.undo();
    expect(e.probs).toEqual(before);
    expect(e.questionCount).toBe(0);
  });

  it("prunes voice questions when there are no vocals", () => {
    const e = new AkinatorEngine();
    e.answer("voice_present", -1);
    expect(e.pruned.has("rap")).toBe(true);
  });

  it("identifies Techno from typical answers", () => {
    const e = new AkinatorEngine();
    const ans: Record<string, number> = { synth: 1, four_floor: 1, dark: 1, hypnotic: 1, voice_present: -1, euphoric: -1, cavernous: 1, dance: 1 };
    while (!e.isConverged()) {
      const q = e.nextQuestion()!;
      e.answer(q.attribute.id, ans[q.attribute.id] ?? 0);
    }
    expect(e.ranked()[0]!.genre.id).toBe("techno");
  });

  it("drilldown restricts to subgenres", () => {
    const e = new AkinatorEngine({ parent: "house" });
    expect(e.candidates.every((g) => g.parent === "house")).toBe(true);
  });
});

describe("isClear", () => {
  it("is clear when one subgenre dominates the prior answers", () => {
    const e = new AkinatorEngine({ parent: "house", priorAnswers: [{ attributeId: "acid", value: 1 }, { attributeId: "retro", value: 1 }, { attributeId: "hypnotic", value: 1 }, { attributeId: "voice_present", value: -1 }] });
    expect(e.ranked()[0]!.genre.id).toBe("acid_house");
    expect(e.isClear()).toBe(true);
  });
  it("is not clear with no information", () => {
    expect(new AkinatorEngine({ parent: "house" }).isClear()).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { GenreGenieEngine, likelihood } from "./engine";
import { GENRES, ATTRIBUTES } from "./data";

describe("GenreGenieEngine Core Unit Tests", () => {
  it("clamps likelihood between 0.05 and 0.95", () => {
    expect(likelihood(1, 1)).toBe(0.95);
    expect(likelihood(-1, 1)).toBe(0.05);
    expect(likelihood(0, 1)).toBe(0.5);
  });

  it("undo restores previous probabilities exactly", () => {
    const e = new GenreGenieEngine();
    const before = [...e.probs];
    e.answer("sound_electronic_dominant", 1);
    e.undo();
    expect(e.probs).toEqual(before);
    expect(e.questionCount).toBe(0);
  });

  it("prunes voice questions when there are no vocals", () => {
    const e = new GenreGenieEngine();
    e.answer("voice_present", -1);
    expect(e.pruned.has("voice_rapping_spoken")).toBe(true);
    expect(e.pruned.has("voice_screaming_growls")).toBe(true);
  });

  it("identifies Techno from typical answers", () => {
    const e = new GenreGenieEngine();
    const ans: Record<string, number> = {
      sound_electronic_dominant: 1,
      pulse_four_on_the_floor: 1,
      atmo_dark_dystopian: 1,
      voice_present: -1,
      sound_acid_303_squelch: -1,
      pulse_swung_groove: -1,
      sound_bright_glossy_clean: -1,
    };
    while (!e.isConverged()) {
      const q = e.nextQuestion()!;
      e.answer(q.attribute.id, ans[q.attribute.id] ?? -1);
    }
    expect(e.ranked()[0]!.genre.id).toBe("techno");
  });

  it("drilldown restricts to subgenres", () => {
    const e = new GenreGenieEngine({ parent: "house" });
    expect(e.candidates.length).toBeGreaterThan(0);
    expect(e.candidates.every((g) => g.parent === "house")).toBe(true);
  });

  it("is clear when one subgenre dominates the prior answers", () => {
    const e = new GenreGenieEngine({
      parent: "techno",
      priorAnswers: [
        { attributeId: "sound_acid_303_squelch", value: 1 },
        { attributeId: "pulse_tempo_fast", value: 1 },
      ],
    });
    expect(e.ranked()[0]!.genre.id).toBe("acid_techno");
    expect(e.isClear()).toBe(true);
  });

  it("is not clear with no information", () => {
    expect(new GenreGenieEngine({ parent: "house" }).isClear()).toBe(false);
  });

  it("does not repeat the same question directly after answering 'Don't know'", () => {
    const e = new GenreGenieEngine();
    const q1 = e.nextQuestion()!;
    e.answer(q1.attribute.id, 0); // User answers Don't know (0)
    const q2 = e.nextQuestion()!;
    expect(q2.attribute.id).not.toBe(q1.attribute.id);

    e.answer(q2.attribute.id, 0);
    const q3 = e.nextQuestion()!;
    expect(q3.attribute.id).not.toBe(q2.attribute.id);
    expect(q3.attribute.id).not.toBe(q1.attribute.id);

    e.answer(q3.attribute.id, 0);
    const q4 = e.nextQuestion()!;
    expect(q4.attribute.id).not.toBe(q3.attribute.id);
    expect(q4.attribute.id).not.toBe(q2.attribute.id);
    expect(q4.attribute.id).not.toBe(q1.attribute.id);
  });

  it("re-prompts unsure questions only with alternativePrompt after a cooldown", () => {
    const e = new GenreGenieEngine();
    const q1 = e.nextQuestion()!;
    e.answer(q1.attribute.id, 0); // unsure

    // Ask 3 more distinct questions
    for (let i = 0; i < 3; i++) {
      const q = e.nextQuestion()!;
      expect(q.attribute.id).not.toBe(q1.attribute.id);
      e.answer(q.attribute.id, 1);
    }

    // Now that cooldown has passed, if an alternative question is selected, it must have isAlternative: true
    const next = e.nextQuestion();
    if (next && next.attribute.id === q1.attribute.id) {
      expect(next.isAlternative).toBe(true);
      expect(next.attribute.alternativePrompt).toBeDefined();
    }
  });
});

describe("Genre Genie Matrix 100% Convergence Suite", () => {
  it("should have all 76 genres and 46 attributes loaded", () => {
    expect(GENRES.length).toBe(76);
    expect(ATTRIBUTES.length).toBe(46);
  });

  it("should achieve 100% convergence across all 42 Macro genres", () => {
    const macroGenres = GENRES.filter((g) => g.tier === "macro");
    expect(macroGenres.length).toBe(42);

    let passedCount = 0;

    for (const target of macroGenres) {
      const engine = new GenreGenieEngine();
      let passed = false;

      for (let step = 0; step < 25; step++) {
        const next = engine.nextQuestion();
        if (!next || next.gain < 0.005) break;

        const { attribute } = next;
        const w = target.weights[attribute.id] ?? 0.0;
        const val = w > 0 ? 1.0 : -1.0;

        engine.answer(attribute.id, val);

        const ranked = engine.ranked();
        const top = ranked[0]!;
        const runner = ranked[1];
        const margin = runner ? top.prob - runner.prob : 1.0;

        if (top.genre.id === target.id && (top.prob >= 0.55 || (step >= 2 && margin > 0.25))) {
          passed = true;
          break;
        }
      }

      if (passed) passedCount++;
    }

    expect(passedCount).toBe(macroGenres.length);
  });

  it("should achieve 100% convergence across all 34 Micro subgenres within clusters", () => {
    const microGenres = GENRES.filter((g) => g.tier === "micro");
    expect(microGenres.length).toBe(34);

    let passedCount = 0;

    for (const target of microGenres) {
      const engine = new GenreGenieEngine({ parent: target.parent! });
      let passed = false;

      for (let step = 0; step < 25; step++) {
        const next = engine.nextQuestion();
        if (!next || next.gain < 0.005) break;

        const { attribute } = next;
        const w = target.weights[attribute.id] ?? 0.0;
        const val = w > 0 ? 1.0 : -1.0;

        engine.answer(attribute.id, val);

        const ranked = engine.ranked();
        const top = ranked[0]!;
        const runner = ranked[1];
        const margin = runner ? top.prob - runner.prob : 1.0;

        if (top.genre.id === target.id && (top.prob >= 0.55 || (step >= 2 && margin > 0.25))) {
          passed = true;
          break;
        }
      }

      if (passed) passedCount++;
    }

    expect(passedCount).toBe(microGenres.length);
  });
});

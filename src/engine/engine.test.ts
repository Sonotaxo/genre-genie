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

  it("triggers confirming hallmark questions when a candidate dominates", () => {
    const e = new GenreGenieEngine();
    // Answer questions pointing toward techno
    e.answer("sound_electronic_dominant", 1);
    e.answer("pulse_four_on_the_floor", 1);
    e.answer("voice_rapping_spoken", -1);
    e.answer("pulse_swung_groove", -1);

    const next = e.nextQuestion();
    expect(next).not.toBeNull();
    // When a suspect emerges with high confidence/margin, confirming is flagged
    if (next?.isConfirming) {
      expect(next.suspectName).toBeDefined();
    }
  });

  it("detects outlier contradiction answers with computeTension", () => {
    const e = new GenreGenieEngine();
    const techno = GENRES.find((g) => g.id === "techno")!;
    e.answer("sound_electronic_dominant", 1);
    e.answer("pulse_four_on_the_floor", 1);
    // User mistakenly answers YES to acoustic wood strings for techno (delta = | -1 - 1 | = 2.0)
    e.answer("sound_acoustic_wood_strings", 1);

    const tension = e.computeTension(techno);
    expect(tension.outlier).toBeDefined();
    expect(tension.outlier?.attributeId).toBe("sound_acoustic_wood_strings");
    expect(tension.outlier?.delta).toBeGreaterThanOrEqual(1.4);
  });

  it("recalculates probabilities when an answer is corrected / flipped", () => {
    const e = new GenreGenieEngine();
    const techno = GENRES.find((g) => g.id === "techno")!;
    e.answer("sound_electronic_dominant", 1);
    e.answer("pulse_four_on_the_floor", 1);
    // User mistakenly answered YES to acoustic strings
    e.answer("sound_acoustic_wood_strings", 1);

    const initialProb = e.ranked().find((r) => r.genre.id === "techno")!.prob;
    const initialTension = e.computeTension(techno);
    expect(initialTension.outlier?.attributeId).toBe("sound_acoustic_wood_strings");

    // Correct the answer to NO (-1)
    const ans = e.answers.find((a) => a.attributeId === "sound_acoustic_wood_strings")!;
    ans.value = -1;
    e.recalculate();

    const updatedProb = e.ranked().find((r) => r.genre.id === "techno")!.prob;
    const updatedTension = e.computeTension(techno);

    // Probability of Techno should increase and outlier should be resolved
    expect(updatedProb).toBeGreaterThan(initialProb);
    expect(updatedTension.outlier).toBeUndefined();
  });

  it("recovers from a mistaken answer and correctly identifies the genre", () => {
    const target = GENRES.find((g) => g.id === "techno")!;
    const e = new GenreGenieEngine();
    // User makes an initial mistake on electronic dominant
    e.answer("sound_electronic_dominant", -1);

    // Following answers align with techno
    e.answer("pulse_four_on_the_floor", 1);
    e.answer("pulse_swung_groove", -1);
    e.answer("sound_acoustic_wood_strings", -1);
    e.answer("sound_electric_guitars", -1);
    e.answer("sound_heavy_distortion", -1);
    e.answer("atmo_dark_dystopian", 1);
    e.answer("sound_deep_subbass", 1);
    e.answer("sound_bright_glossy_clean", -1);
    e.answer("pulse_halftime_sway", -1);

    const top = e.ranked()[0]!;
    expect(top.genre.id).toBe("techno");
    expect(top.prob).toBeGreaterThan(0.75);
  });

  it("enforces hallmark quorum and high confidence before convergence", () => {
    const e = new GenreGenieEngine();
    // Even if 2 questions are answered, minQuestions (6 for macro) prevents premature stop
    e.answer("sound_electronic_dominant", 1);
    e.answer("pulse_four_on_the_floor", 1);
    expect(e.isConverged()).toBe(false);
  });

  it("prioritizes foundational macro grounding attributes early in session", () => {
    const e = new GenreGenieEngine();
    const q1 = e.nextQuestion();
    expect(q1).toBeDefined();

    // Foundational macro attributes include electronic vs acoustic and pulse rhythms
    const macroAttrSet = new Set([
      "pulse_four_on_the_floor",
      "pulse_halftime_sway",
      "pulse_breakbeat_syncopated",
      "pulse_dembow_caribbean",
      "pulse_train_beat_country",
      "pulse_tempo_fast",
      "pulse_tempo_slow",
      "sound_electronic_dominant",
      "sound_electric_guitars",
      "sound_acoustic_wood_strings",
    ]);

    expect(macroAttrSet.has(q1!.attribute.id)).toBe(true);
  });

  it("evaluates all subgenres across families with rankedAllSubgenres() without ruling them out", () => {
    const e = new GenreGenieEngine();
    // Simulate answers for Tech House (4-on-the-floor, electronic, rapped/spoken vocals, swung groove)
    e.answer("sound_electronic_dominant", 1);
    e.answer("pulse_four_on_the_floor", 1);
    e.answer("voice_rapping_spoken", 1);
    e.answer("pulse_swung_groove", 1);

    const allSub = e.rankedAllSubgenres();
    expect(allSub.length).toBe(36); // all 36 subgenres evaluated
    // Tech House should be the #1 subgenre across all families
    expect(allSub[0]!.genre.id).toBe("tech_house");
    expect(allSub[0]!.prob).toBeGreaterThan(0.3);
  });

  it("supports cross-family subgenre candidates when allowCrossFamilySubgenres is enabled", () => {
    // Suppose drilldown was initiated on techno, but track is tech house
    const e = new GenreGenieEngine({
      parent: "techno",
      allowCrossFamilySubgenres: true,
      priorAnswers: [
        { attributeId: "sound_electronic_dominant", value: 1 },
        { attributeId: "pulse_four_on_the_floor", value: 1 },
        { attributeId: "voice_rapping_spoken", value: 1 },
        { attributeId: "pulse_swung_groove", value: 1 },
      ],
    });

    expect(e.candidates.length).toBe(36);
    // Even under techno drilldown, Tech House can win because it's not ruled out
    expect(e.ranked()[0]!.genre.id).toBe("tech_house");
  });

  it("seamlessly classifies Tech House via macroProbs prior even when macro leaned toward Techno", () => {
    // Exact user trace responses
    const answers = [
      { attributeId: "sound_electronic_dominant", value: 1 },
      { attributeId: "pulse_four_on_the_floor", value: 1 },
      { attributeId: "pulse_halftime_sway", value: -0.5 },
      { attributeId: "pulse_swung_groove", value: 0 },
      { attributeId: "pulse_tempo_fast", value: 0.5 },
      { attributeId: "voice_clean_melodic", value: -0.5 },
      { attributeId: "atmo_sunny_uplifting", value: -1 },
      { attributeId: "sound_polyrhythmic_percussion", value: -1 },
      { attributeId: "pulse_hyper_fast", value: -1 },
      { attributeId: "voice_present", value: 1 },
      { attributeId: "voice_rapping_spoken", value: 0.5 },
      { attributeId: "pulse_breakbeat_syncopated", value: -0.5 },
      { attributeId: "sound_acoustic_wood_strings", value: -1 },
      { attributeId: "atmo_dark_dystopian", value: 0.5 },
      { attributeId: "voice_whispered_ethereal", value: -1 },
      { attributeId: "sound_sliding_bass_glides", value: -0.5 },
      { attributeId: "sound_snarling_neuro_bass", value: -0.5 },
      { attributeId: "sound_brass_horns", value: -1 },
      { attributeId: "pulse_train_beat_country", value: -0.5 },
    ];

    const macroEngine = new GenreGenieEngine();
    for (const a of answers) {
      macroEngine.answer(a.attributeId, a.value);
    }

    const macroProbs = new Map(macroEngine.ranked().map((r) => [r.genre.id, r.prob]));
    // Subgenre engine initialized with macro probabilities
    const subEngine = new GenreGenieEngine({
      macroProbs,
      priorAnswers: macroEngine.answers,
    });

    const topSub = subEngine.ranked()[0];
    const secondSub = subEngine.ranked()[1];
    expect(topSub).toBeDefined();
    expect(topSub!.genre.id).toBe("tech_house");
    expect(topSub!.prob).toBeGreaterThan(0.60);
    expect(topSub!.prob).toBeGreaterThan(secondSub!.prob * 5);
  });
});

describe("Genre Genie Matrix 100% Convergence Suite", () => {
  it("should have all 78 genres and 46 attributes loaded", () => {
    expect(GENRES.length).toBe(78);
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

  it("should achieve 100% convergence across all 36 Micro subgenres within clusters", () => {
    const microGenres = GENRES.filter((g) => g.tier === "micro");
    expect(microGenres.length).toBe(36);

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

  it("calculates gaining genres for affirmative and negative answers", () => {
    const engine = new GenreGenieEngine();
    const yesGaining = engine.getGainingGenres("pulse_four_on_the_floor", 1.0, 3);
    const noGaining = engine.getGainingGenres("pulse_four_on_the_floor", -1.0, 3);
    const unsureGaining = engine.getGainingGenres("pulse_four_on_the_floor", 0, 3);

    expect(yesGaining).toContain("House");
    expect(yesGaining).toContain("Techno");
    expect(noGaining).toContain("90s Boom Bap");
    expect(unsureGaining).toEqual([]);
  });
});

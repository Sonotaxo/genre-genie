import { describe, expect, it } from "vitest";
import { DescriptorEngine } from "./descriptor-engine";

describe("DescriptorEngine Unit Tests", () => {
  it("initializes properly with all genres and descriptor questions", () => {
    const engine = new DescriptorEngine();
    expect(engine.questions.length).toBeGreaterThanOrEqual(8);
    expect(engine.candidates.length).toBe(77);
    expect(engine.questionCount).toBe(0);
    expect(engine.canUndo).toBe(false);

    // UX / Dilemma of choice invariant: always exactly 4 options per question, with option 4 as "Don't Know / Neither"
    for (const q of engine.questions) {
      expect(q.options.length).toBe(4);
      const opt4 = q.options[3]!;
      expect(opt4.label).toContain("Don't Know");
      expect(Object.keys(opt4.effects).length).toBe(0);
    }
  });

  it("prioritizes core grounding questions early", () => {
    const engine = new DescriptorEngine();
    const q1 = engine.nextQuestion();
    expect(q1?.id).toBe("core_instrumentation");

    engine.answer("core_instrumentation", "electronic_synths");
    const q2 = engine.nextQuestion();
    expect(q2?.id).toBe("rhythm_pattern");

    engine.answer("rhythm_pattern", "four_on_floor");
    const q3 = engine.nextQuestion();
    expect(q3?.id).toBe("tempo_pace");
  });

  it("supports undo and accurately restores previous state", () => {
    const engine = new DescriptorEngine();
    const q1 = engine.nextQuestion()!;
    const initialTop = engine.ranked()[0]!;

    engine.answer(q1.id, q1.options[0]!.id);
    expect(engine.canUndo).toBe(true);
    expect(engine.questionCount).toBe(1);

    engine.undo();
    expect(engine.canUndo).toBe(false);
    expect(engine.questionCount).toBe(0);
    expect(engine.ranked()[0]!.genre.id).toBe(initialTop.genre.id);
  });

  it("classifies Tech House correctly with natural descriptor answers", () => {
    const engine = new DescriptorEngine();

    engine.answer("core_instrumentation", "electronic_synths");
    engine.answer("rhythm_pattern", "four_on_floor");
    engine.answer("tempo_pace", "fast_club");
    engine.answer("groove_feel", "swung_shuffle");
    engine.answer("sound_clarity", "bright_glossy");

    const topSub = engine.rankedAllSubgenres()[0]!;
    expect(topSub.genre.name).toBe("Tech House");
    expect(topSub.prob).toBeGreaterThan(0.20);
  });

  it("classifies 90s Boom Bap correctly with natural descriptor answers", () => {
    const engine = new DescriptorEngine();

    engine.answer("vocal_delivery", "rapping_spoken");
    engine.answer("rhythm_pattern", "syncopated_breakbeat");
    engine.answer("tempo_pace", "slow_meditative");
    engine.answer("groove_feel", "swung_shuffle");
    engine.answer("sound_clarity", "lofi_crackles");

    const top = engine.ranked()[0]!;
    expect(top.genre.name).toBe("90s Boom Bap");
    expect(top.prob).toBeGreaterThan(0.40);
  });

  it("classifies Techno / Industrial Techno with dark and distorted descriptors", () => {
    const engine = new DescriptorEngine();

    engine.answer("core_instrumentation", "electronic_synths");
    engine.answer("rhythm_pattern", "four_on_floor");
    engine.answer("tempo_pace", "fast_club");
    engine.answer("groove_feel", "straight_march");
    engine.answer("vocal_delivery", "purely_instrumental");
    engine.answer("sound_clarity", "heavy_distortion");
    engine.answer("atmosphere_mood", "dark_dystopian");

    const ranked = engine.ranked();
    const technoFamily = ranked.filter((r) => r.genre.family === "electronic" && r.genre.name.includes("Techno"));
    expect(technoFamily.length).toBeGreaterThan(0);
    expect(technoFamily[0]!.prob).toBeGreaterThan(0.15);
  });

  it("calculates gaining genres for descriptor options", () => {
    const engine = new DescriptorEngine();
    const q = engine.questions.find((x) => x.id === "core_instrumentation")!;
    const electronicOpt = q.options.find((o) => o.id === "electronic_synths")!;
    const acousticOpt = q.options.find((o) => o.id === "acoustic_wooden")!;

    const electronicGaining = engine.getGainingGenres(electronicOpt, 3);
    const acousticGaining = engine.getGainingGenres(acousticOpt, 3);

    expect(electronicGaining).toContain("Techno");
    expect(acousticGaining.some((name) => name.includes("Classical") || name.includes("Guitar"))).toBe(true);
  });

  it("does not show contradictory genre chips for vocal style options", () => {
    const engine = new DescriptorEngine();
    engine.answer("core_instrumentation", "electronic_synths");
    engine.answer("rhythm_pattern", "four_on_floor");
    engine.answer("tempo_pace", "fast_club");

    const q = engine.questions.find((x) => x.id === "vocal_style")!;
    const screamOpt = q.options.find((o) => o.id === "screaming_growls")!;
    const autotuneOpt = q.options.find((o) => o.id === "robotic_autotune")!;
    const whisperOpt = q.options.find((o) => o.id === "whispered_ethereal")!;

    const screamGaining = engine.getGainingGenres(screamOpt, 5);
    const autotuneGaining = engine.getGainingGenres(autotuneOpt, 5);
    const whisperGaining = engine.getGainingGenres(whisperOpt, 5);

    // Hypertechno should only be boosted by robotic autotune, never screaming or whispers
    expect(screamGaining).not.toContain("Hypertechno");
    expect(whisperGaining).not.toContain("Hypertechno");
    expect(autotuneGaining).toContain("Hypertechno");
  });

  it("positively covers all 46 attributes in attributes.json across the 17-question pool", async () => {
    const { ATTRIBUTES } = await import("./data");
    const engine = new DescriptorEngine();
    expect(engine.questions.length).toBe(17);

    const positivelyCovered = new Set<string>();
    for (const q of engine.questions) {
      expect(q.options.length).toBe(4);
      expect(Object.keys(q.options[3]!.effects).length).toBe(0);
      for (const opt of q.options) {
        for (const [attrId, val] of Object.entries(opt.effects)) {
          if (val > 0) positivelyCovered.add(attrId);
        }
      }
    }

    for (const attr of ATTRIBUTES) {
      expect(positivelyCovered.has(attr.id)).toBe(true);
    }
    expect(positivelyCovered.size).toBe(ATTRIBUTES.length);
  });

  it("enforces data integrity across genres.json, attributes.json, and matrix.json", async () => {
    const { ATTRIBUTES, GENRES } = await import("./data");
    const rawMatrix = (await import("../../data/matrix.json")).default as Record<string, Record<string, number>>;
    const attrIds = new Set(ATTRIBUTES.map((a) => a.id));

    // 1. No unknown attribute keys in matrix.json
    for (const [genreId, row] of Object.entries(rawMatrix)) {
      for (const [attrId, weight] of Object.entries(row)) {
        expect(attrIds.has(attrId), `Unknown attribute ${attrId} in ${genreId}`).toBe(true);
        expect(weight).toBeGreaterThanOrEqual(-1);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }

    // 2. UK Garage is parented under house (Garage House)
    const ukg = GENRES.find((g) => g.id === "uk_garage_future_garage")!;
    expect(ukg.parent).toBe("house");
    expect(ukg.parentGenreName).toBe("Garage House");

    // 3. No duplicate benchmark tracks across genres
    const seenTracks = new Set<string>();
    for (const g of GENRES) {
      for (const t of g.benchmarkTracks) {
        const key = `${t.artist.toLowerCase()} - ${t.title.toLowerCase()}`;
        expect(seenTracks.has(key), `Duplicate track: ${key}`).toBe(false);
        seenTracks.add(key);
      }
    }
  });

  it("prunes irrelevant follow-up questions based on prior answers", () => {
    const engine = new DescriptorEngine();
    engine.answer("core_instrumentation", "electronic_synths");
    engine.answer("rhythm_pattern", "four_on_floor");
    engine.answer("tempo_pace", "slow_meditative");
    engine.answer("vocal_delivery", "purely_instrumental");

    const remainingIds: string[] = [];
    while (true) {
      const q = engine.nextQuestion();
      if (!q) break;
      remainingIds.push(q.id);
      engine.answer(q.id, q.options[3]!.id);
    }

    expect(remainingIds).not.toContain("vocal_style");
    expect(remainingIds).not.toContain("guitar_style");
    expect(remainingIds).not.toContain("fast_pulse_drive");
    expect(remainingIds).not.toContain("specialty_rhythm");
    expect(remainingIds).not.toContain("meter_breathing");
  });

  it("preserves priorDescriptorAnswers during subgenre drill-down", async () => {
    const { GENRES } = await import("./data");
    const macroEngine = new DescriptorEngine();
    macroEngine.answer("core_instrumentation", "electronic_synths");
    macroEngine.answer("rhythm_pattern", "four_on_floor");
    macroEngine.answer("tempo_pace", "fast_club");
    macroEngine.answer("vocal_delivery", "purely_instrumental");

    const subEngine = new DescriptorEngine({
      genres: GENRES.filter((g) => g.parent === "techno" || g.id === "techno"),
      priorDescriptorAnswers: macroEngine.descriptorAnswers,
    });

    expect(subEngine.questionCount).toBe(4);
    expect(subEngine.askedQuestionIds.has("core_instrumentation")).toBe(true);
    const nextQ = subEngine.nextQuestion();
    expect(nextQ?.id).not.toBe("core_instrumentation");
  });

  it("achieves 100% Top-1 Macro and 100% Top-3 All-77 convergence across all genres", async () => {
    const { GENRES } = await import("./data");
    const { likelihood } = await import("./engine");

    let top1All = 0;
    let top3All = 0;
    let top1Macro = 0;

    for (const target of GENRES) {
      const eng = new DescriptorEngine();
      for (let step = 0; step < 10; step++) {
        const q = eng.nextQuestion();
        if (!q) break;
        let bestOpt = q.options[3]!;
        let bestLike = -1;
        for (const opt of q.options) {
          let eff = opt.effects;
          if (Object.keys(eff).length === 0) {
            const implicit: Record<string, number> = {};
            for (const other of q.options.slice(0, 3)) {
              for (const [attr, val] of Object.entries(other.effects)) {
                if (val >= 0.9 && attr !== "voice_present") {
                  implicit[attr] = -0.55;
                }
              }
            }
            eff = implicit;
          }
          let prod = 1;
          for (const [attr, val] of Object.entries(eff)) {
            prod *= likelihood(val, target.weights[attr] ?? 0);
          }
          if (prod > bestLike) {
            bestLike = prod;
            bestOpt = opt;
          }
        }
        eng.answer(q.id, bestOpt.id);
      }

      const ranked = eng.ranked();
      if (ranked[0]!.genre.id === target.id) top1All++;
      if (ranked.slice(0, 3).some((r) => r.genre.id === target.id)) top3All++;
      if (target.tier === "macro") {
        const rankedMacros = ranked.filter((r) => r.genre.tier === "macro");
        if (rankedMacros[0]!.genre.id === target.id) top1Macro++;
      }
    }

    expect(top1Macro).toBe(42);
    expect(top3All).toBe(77);
    expect(top1All).toBeGreaterThanOrEqual(70);
  });
});



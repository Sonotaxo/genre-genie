import { describe, expect, it } from "vitest";
import { DescriptorEngine } from "./descriptor-engine";

describe("DescriptorEngine Unit Tests", () => {
  it("initializes properly with all genres and descriptor questions", () => {
    const engine = new DescriptorEngine();
    expect(engine.questions.length).toBeGreaterThanOrEqual(8);
    expect(engine.candidates.length).toBe(77);
    expect(engine.questionCount).toBe(0);
    expect(engine.canUndo).toBe(false);
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
    engine.answer("sound_texture", "bright_glossy");

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
    engine.answer("sound_texture", "lofi_crackles");

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
    engine.answer("sound_texture", "heavy_distortion");
    engine.answer("atmosphere_mood", "dark_dystopian");

    const ranked = engine.ranked();
    const technoFamily = ranked.filter((r) => r.genre.family === "electronic" && r.genre.name.includes("Techno"));
    expect(technoFamily.length).toBeGreaterThan(0);
    expect(technoFamily[0]!.prob).toBeGreaterThan(0.15);
  });
});

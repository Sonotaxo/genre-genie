import { describe, it, expect } from "vitest";
import { GenreGenieEngine } from "./engine";
import { GENRES } from "./data";

describe("End-to-End Questionnaire Integration Tests", () => {
  const testCases = [
    {
      genreName: "Tech House",
      id: "tech_house",
      expectedMacro: "house",
    },
    {
      genreName: "Hypertechno",
      id: "hypertechno",
      expectedMacro: "techno",
    },
    {
      genreName: "Hard Tech",
      id: "hard_techno",
      expectedMacro: "techno",
    },
    {
      genreName: "Psy Trance",
      id: "psytrance",
      expectedMacro: "trance",
    },
    {
      genreName: "Minimal Techno",
      id: "minimal_techno",
      expectedMacro: "techno",
    },
  ];

  for (const tc of testCases) {
    it(`classifies "${tc.genreName}" correctly through a complete questionnaire from the beginning`, () => {
      const target = GENRES.find((g) => g.id === tc.id);
      expect(target).toBeDefined();

      // Phase 1: Macro Questionnaire from the beginning (empty engine)
      const macroEngine = new GenreGenieEngine();
      let macroSteps = 0;

      while (!macroEngine.isConverged(20) && macroSteps < 20) {
        const next = macroEngine.nextQuestion();
        if (!next || next.gain < 0.005) break;

        const w = target!.weights[next.attribute.id] ?? 0.0;
        const val = w > 0.2 ? 1.0 : w < -0.2 ? -1.0 : 0.0;
        macroEngine.answer(next.attribute.id, val);
        macroSteps++;
      }

      const topMacro = macroEngine.ranked()[0];
      expect(topMacro).toBeDefined();
      expect(topMacro!.genre.id).toBe(tc.expectedMacro);
      expect(topMacro!.prob).toBeGreaterThanOrEqual(0.7);

      // Phase 2: Micro / Subgenre Drilldown round
      const subEngine = new GenreGenieEngine({
        parent: topMacro!.genre.id,
        priorAnswers: macroEngine.answers,
      });

      let subSteps = 0;
      if (!subEngine.isClear()) {
        while (
          !subEngine.isConverged(8 + macroEngine.answers.length) &&
          subSteps < 12
        ) {
          const next = subEngine.nextQuestion();
          if (!next || next.gain < 0.005) break;

          const w = target!.weights[next.attribute.id] ?? 0.0;
          const val = w > 0.2 ? 1.0 : w < -0.2 ? -1.0 : 0.0;
          subEngine.answer(next.attribute.id, val);
          subSteps++;
        }
      }

      const finalRanked = subEngine.ranked();
      const finalTop = finalRanked[0];
      expect(finalTop).toBeDefined();
      expect(finalTop!.genre.id).toBe(tc.id);
      expect(finalTop!.prob).toBeGreaterThanOrEqual(0.75);
    });
  }
});

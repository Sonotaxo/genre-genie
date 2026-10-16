# Project rules
- Genre engine lives in pure TypeScript under src/engine/ (data.ts + engine.ts) with vitest tests; keep UI free of scoring logic so it stays testable.
- Feedback traces are stored in localStorage until a backend is enabled.
- **Adding a new subgenre**: Follow the step-by-step implementation guide in `docs/adding-a-subgenre.md`. Ensure all 46 attribute weights in `data/matrix.json`, unique benchmark tracks in `data/genres.json`, and test counts in `src/engine/engine.test.ts` and `src/engine/descriptor-engine.test.ts` are updated.

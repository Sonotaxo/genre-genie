# Project rules
- Genre engine lives in pure TypeScript under src/engine/ (data.ts + engine.ts) with vitest tests; keep UI free of scoring logic so it stays testable.
- Feedback traces are stored in localStorage until a backend is enabled.

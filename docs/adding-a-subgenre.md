# Adding a New Sub-Genre to Genre Genie

This guide provides a standardized, step-by-step workflow for contributors and autonomous AI agents to add a new sub-genre to Genre Genie without regressions.

---

## 1. Architectural Overview

Genre Genie operates on a two-tier taxonomy:
1. **Macro Genres** (`tier: "macro"`, e.g. *Techno, House, Trance, Drum & Bass, Dubstep*): Broad musical families identified during the initial phase.
2. **Micro Sub-Genres** (`tier: "micro"`, e.g. *Melodic Techno, Downtempo Techno, Tech House, Liquid DnB*): Specialized movements parented under a specific Macro Genre (`parentGenreId`).

The engine computes genre probabilities using a Bayesian likelihood matrix across **46 sensory attributes** (pulse, sound, voice, atmosphere). All calculations run 100% clientside in TypeScript.

---

## 2. File Map

When adding a sub-genre, you will touch or consult these files:

| File | Purpose | Action |
| :--- | :--- | :--- |
| [`data/genres.json`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/data/genres.json) | Genre metadata, hallmarks, benchmarks | **Append** new genre object |
| [`data/matrix.json`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/data/matrix.json) | 46-attribute likelihood weight row | **Append** 46-key weights row |
| [`data/attributes.json`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/data/attributes.json) | The 46 sensory attribute definitions & prompts | **Consult** to avoid prompt misinterpretations |
| [`src/engine/engine.test.ts`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/src/engine/engine.test.ts) | 100% Bayesian matrix convergence suite | **Update** total & micro genre count assertions |
| [`src/engine/descriptor-engine.test.ts`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/src/engine/descriptor-engine.test.ts) | 100% Descriptor questionnaire convergence suite | **Update** total candidate count assertions |

---

## 3. Step-by-Step Implementation Recipe

### Step 1: Extract Data from GitHub Issue
Read the GitHub issue created from `.github/ISSUE_TEMPLATE/new_subgenre.yml`:
- **Name**: Official display name (e.g. `Future Bass`)
- **ID**: `snake_case` identifier (e.g. `future_bass`)
- **Parent Genre ID**: Target macro genre ID (e.g. `dubstep`, `techno`, `house`)
- **Family ID**: Target family (e.g. `electronic`, `rock`, etc.)
- **Aliases**: Common alternative scene names or abbreviations
- **Summary**: 2–3 sentences explaining the sonic identity
- **3 Benchmark Tracks**: Exactly 3 tracks (`artist` and `title`)
- **Sensory Hallmarks**: 4 descriptors (`pulse`, `sound`, `voice`, `atmosphere`)
- **Distinction Notes**: Clear explanation contrasting it with its parent and sibling genres

---

### Step 2: Add Entry to `data/genres.json`

Append the sub-genre object in [`data/genres.json`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/data/genres.json).

```json
{
  "id": "your_subgenre_id",
  "name": "Display Name",
  "familyId": "electronic",
  "tier": "micro",
  "parentGenreId": "techno",
  "aliases": [
    "Alias 1",
    "Alias 2"
  ],
  "description": "Vivid 2-3 sentence description of the sonic aesthetic, groove, and feeling.",
  "popularityWeight": 0.5,
  "benchmarkTracks": [
    { "artist": "Artist 1", "title": "Track Title 1" },
    { "artist": "Artist 2", "title": "Track Title 2" },
    { "artist": "Artist 3", "title": "Track Title 3" }
  ],
  "sensoryHallmarks": {
    "pulse": "Description of tempo, rhythm, drum kick feel",
    "sound": "Description of synths, bass, textures, distortion",
    "voice": "Description of vocals (or instrumental)",
    "atmosphere": "Description of emotional mood and spatial acoustic feel"
  },
  "distinctionNotes": "Unlike [Parent/Sibling Genre], [New Genre] emphasizes...",
  "parentGenreName": "Techno",
  "referenceUrl": "https://rateyourmusic.com/genre/your-subgenre/"
}
```

> [!IMPORTANT]
> **No Duplicate Benchmark Tracks**: The test suite strictly validates that no benchmark track is shared across genres. Ensure all 3 tracks are unique in the catalog.

---

### Step 3: Add the 46 Attribute Weights to `data/matrix.json`

In [`data/matrix.json`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/data/matrix.json), add the row keyed by your subgenre's `id`.

Each value is a float between `-1.0` and `1.0`:
- `+1.0` to `+0.7`: Mandatory / Defining characteristic (e.g. four-on-the-floor kick, electronic sound).
- `+0.4` to `+0.6`: Common, typical, but not strictly universal.
- `0.0`: Completely neutral, variable, or irrelevant to this genre.
- `-0.4` to `-0.6`: Uncommon, discouraged.
- `-0.8` to `-1.0`: Contradiction / Polar opposite (e.g. electric guitars in pure minimal electronic).

```json
  "your_subgenre_id": {
    "pulse_four_on_the_floor": 1,
    "pulse_breakbeat_syncopated": -0.95,
    "pulse_halftime_sway": -0.95,
    "pulse_tempo_fast": -0.95,
    "pulse_hyper_fast": -0.95,
    "pulse_slow_relaxed": 0.95,
    "pulse_swung_groove": 0.5,
    "pulse_free_rubato": -0.95,
    "pulse_dembow_caribbean": -0.95,
    "pulse_reggae_one_drop": -0.95,
    "pulse_galloping_rolling_bass": -0.9,
    "pulse_heavy_breakdown": -0.9,
    "pulse_train_beat_country": -1,
    "sound_electronic_dominant": 1,
    "sound_acoustic_wood_strings": -0.9,
    "sound_electric_guitars": -0.9,
    "sound_heavy_distortion": -0.9,
    "sound_deep_subbass": 0.85,
    "sound_sliding_bass_glides": -0.85,
    "sound_analog_warmth": 0.85,
    "sound_brass_horns": -0.95,
    "sound_lofi_crackles": 0,
    "sound_bright_glossy_clean": -0.7,
    "sound_acid_303_squelch": -0.8,
    "sound_slap_bass_groove": -0.85,
    "sound_snarling_neuro_bass": -0.9,
    "sound_amen_break_chopped": -0.95,
    "sound_distorted_hardstyle_kick": -0.95,
    "sound_nylon_acoustic_guitar": -0.7,
    "sound_polyrhythmic_percussion": 0.6,
    "sound_jangly_indie_guitars": -0.9,
    "sound_pedal_steel_twang": -1,
    "sound_supersaws_anthem": -0.95,
    "sound_dub_echoes": 0.5,
    "voice_present": -0.8,
    "voice_clean_melodic": -0.9,
    "voice_rapping_spoken": -0.95,
    "voice_screaming_growls": -0.95,
    "voice_autotune_vocoder": -0.5,
    "voice_whispered_ethereal": -0.5,
    "voice_choir_wall": -0.8,
    "atmo_dark_dystopian": 0.1,
    "atmo_sunny_uplifting": 0,
    "atmo_nostalgic_melancholy": 0.6,
    "atmo_intimate_bedroom": 0,
    "atmo_violent_aggressive": -0.95
  }
```

> [!WARNING]
> **Pitfall Alert: Never guess an attribute's meaning from its name!**
> Always verify the attribute's actual prompt in [`data/attributes.json`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/data/attributes.json).
> - Example: `sound_bright_glossy_clean` specifically asks: *"Does the music have a sunny, cheerful, commercial radio-pop sound with zero dark shadows?"* If you assign `0.95` to underground dark techno because the production is clean, you will trigger false contradiction alerts for listeners!
> - Example: `pulse_slow_relaxed` means $< 100\text{ BPM}$.

---

### Step 4: Update Unit Test Suite Assertions

When you add a new sub-genre, the total genre count increases by 1 ($N \to N+1$), and the micro sub-genre count increases by 1 ($M \to M+1$).

1. In [`src/engine/engine.test.ts`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/src/engine/engine.test.ts):
   ```typescript
   // Update total genre count (e.g. 78 -> 79)
   expect(GENRES.length).toBe(79);

   // Update micro subgenre count (e.g. 36 -> 37)
   expect(microGenres.length).toBe(37);

   // In "rankedAllSubgenres" and "allowCrossFamilySubgenres":
   expect(allSub.length).toBe(37);
   expect(e.candidates.length).toBe(37);
   ```

2. In [`src/engine/descriptor-engine.test.ts`](file:///Users/steppschuh/Documents/Projects/Steppschuh/genre-genie/src/engine/descriptor-engine.test.ts):
   ```typescript
   // Update candidate count
   expect(engine.candidates.length).toBe(79);

   // In "achieves 100% Top-1 Macro and 100% Top-3 All-N convergence across all genres":
   expect(top3All).toBe(79);
   ```

---

### Step 5: Run Verification Commands

Run the TypeScript typecheck and Vitest suite:

```bash
bun x tsc --noEmit
bun test
```

All tests must pass, especially:
- `Data integrity across genres.json, attributes.json, and matrix.json` (no orphan attributes, valid parents, unique benchmarks).
- `100% convergence across all Macro genres`.
- `100% convergence across all Micro subgenres within clusters`.
- `100% Top-1 Macro and 100% Top-3 All convergence in DescriptorEngine`.

---

### Step 6: Verify User Trace Simulation

Verify that the new subgenre resolves properly using this quick one-liner test script:

```bash
bun -e '
import { DescriptorEngine } from "./src/engine/descriptor-engine";

const eng = new DescriptorEngine();
// Simulate standard answers for your new subgenre:
eng.answer("core_instrumentation", "electronic_synths");
eng.answer("rhythm_pattern", "four_on_floor");
eng.answer("tempo_pace", "slow_meditative");

console.log("Top matches:");
eng.ranked().slice(0, 3).forEach(r => console.log(r.genre.name, (r.prob * 100).toFixed(1) + "%"));
console.log("Tension outlier:", eng.computeTension(eng.ranked()[0].genre));
'
```

Confirm that:
1. The new genre reaches #1 or top contenders for typical answers.
2. `computeTension()` returns `outlier: undefined` (no false contradictions).

---

## 4. Agent Checklist Before Committing

- [ ] `id` is valid snake_case and unused.
- [ ] `parentGenreId` matches an existing Macro Genre in `genres.json`.
- [ ] `tier` is set to `"micro"`.
- [ ] Exactly 3 benchmark tracks are provided with correct capitalization.
- [ ] No benchmark track is duplicated anywhere else in `genres.json`.
- [ ] All 4 sensory hallmarks (`pulse`, `sound`, `voice`, `atmosphere`) are filled.
- [ ] `distinctionNotes` provides clear contrast against parent & siblings.
- [ ] Exactly 46 attributes are present in `matrix.json` with values in $[-1.0, 1.0]$.
- [ ] `attributes.json` prompts were reviewed for all positive weights.
- [ ] Test count assertions updated in `engine.test.ts` and `descriptor-engine.test.ts`.
- [ ] `bun x tsc --noEmit` exits with 0 errors.
- [ ] `bun test` passes 100% across all test files.

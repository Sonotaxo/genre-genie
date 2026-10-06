# Genre Genie

Build Audio-Akinator based on the attached blueprint:

# 🎧 Lovable Project Blueprint: Audio-Akinator

> **Prompt for Lovable**: Copy and paste this document directly into Lovable to generate the complete, production-ready Audio-Akinator application.

---

## 🌟 1. Project Overview & Vision

**Audio-Akinator** is an interactive, Akinator-style 20-questions expert identification engine for music genres.

### The Problem it Solves
Traditional music identification tools (like Shazam) fail when a DJ plays an unreleased track, an ID, or a live remix, or when a listener simply wants to understand *what genre of music* they are hearing. Conversely, music genre databases (RateYourMusic, Every Noise at Once) use academic music theory jargon ("Dorian mode vamp", "subdominant cadence") that non-musicians do not understand.

### The Solution
Audio-Akinator asks intuitive, sensory, physical questions based on what the listener perceives in real time across four perceptual dimensions:
1. 🟢 **The Pulse**: Speed, rhythm, kick drum pattern, and kinetic body movement.
2. 🟣 **The Sound**: Tactile instrument textures (warm analog vs. distorted fuzz vs. acoustic wood vs. liquid squelch).
3. 🔵 **The Voice**: Vocal delivery style (clean singing, rapping, whispered, screamed, or purely instrumental).
4. 🟠 **The Atmosphere**: Spatial resonance and emotional mood (cavernous warehouse, intimate bedroom, sunny beach).

The engine runs a **Shannon Entropy (Information Gain) + Bayesian Update Engine** 100% client-side in TypeScript with zero latency (<5ms per tap), converging on the correct genre in 6–10 questions.

---

## 🛠️ 2. Tech Stack & Dependencies

* **Framework**: React 19 + Vite + TypeScript
* **Styling**: Tailwind CSS v4 + Tailwind Animate
* **Component Primitives**: Radix UI / Shadcn UI components (Card, Button, Progress, Dialog, Badge, Tooltip)
* **Icons**: `lucide-react`
* **Animations & Effects**: `canvas-confetti` (for diagnosis celebration) + CSS keyframe transitions
* **Audio Embeds**: Privacy-enhanced YouTube IFrame embed & Spotify / Apple Music deep links
* **Backend / Crowdsourcing**: Supabase JavaScript Client (`@supabase/supabase-js`) for capturing user corrections and session traces

---

## 🎨 3. Visual Design System & Aesthetics

### Theme: Dark-Mode Electronic / Studio Hardware
Inspired by high-end DJ equipment (Pioneer CDJ-3000, Teenage Engineering, Ableton Push). Dark OLED backgrounds with neon glassmorphism and tactile buttons.

* **Backgrounds**:
  * Base: `#090a0f` (Deep obsidian black)
  * Surface Card: `#12151e` with subtle border `#1e2433` and backdrop blur
  * Elevated Card: `#1a1f2e`
* **Category Color Identity**:
  * 🟢 **The Pulse**: Emerald / Neon Green (`#10b981`, ring/glow `#059669`)
  * 🟣 **The Sound**: Electric Purple / Violet (`#8b5cf6`, ring/glow `#7c3aed`)
  * 🔵 **The Voice**: Cyan / Sky Blue (`#06b6d4`, ring/glow `#0891b2`)
  * 🟠 **The Atmosphere**: Warm Amber / Neon Pink (`#f59e0b` or `#ec4899`)
* **Typography**:
  * Display / Headers: High-contrast sans-serif (e.g. `Plus Jakarta Sans` or `Inter`, font-extrabold)
  * Data / Metrics / Numbers: Monospace (`JetBrains Mono` or `Fira Code`)
* **Haptics & Transitions**:
  * Button presses should feel snappy (`active:scale-95 transition-transform duration-100`).
  * Card transitions should slide horizontally when advancing questions.

---

## 📱 4. Application Pages, Views & Component Flow

The app is a single-page reactive application with 4 distinct state screens:

[ 1. Hero Landing ] ──(Start Game / Pick Family)──> [ 2. Question View ]
                                                          │
                                     (Undo Button <── Rollback Stack)
                                                          │
                                         (Convergence Threshold Met)
                                                          ▼
                                                [ 3. Diagnosis Reveal ]
                                                 /                   \
                               (🔬 Drilldown)   /                     \  (Wrong? Teach Me)
                                               ▼                       ▼
                                   [ 4. Subgenre Modal ]      [ 5. Feedback Modal ]

### View 1: Landing / Primer (`IDLE`)
* **Headline**: "Think of a song or listen to the music playing. Audio-Akinator will guess its genre."
* **Primary Action**: Giant glowing neon CTA button: **"Start Guessing"** (with pulsing soundwave icon).
* **Family Quick-Pills (Direct Shortcuts)**:
  * Fast-track pills: `[⚡ Electronic & Dance]`, `[🎸 Rock & Metal]`, `[🎤 Hip-Hop & Urban]`, `[🎷 Jazz & Soul]`, `[🎻 Classical & Acoustic]`.
  * Clicking a pill filters the candidate pool immediately and jumps straight into that family's subgenre tree.
* **Live Stats Footer**: "54 Genres Cataloged • 41 Sensory Attributes • 100% In-Browser Engine".

### View 2: The Interactive Question Loop (`PLAYING`)
* **Header Bar**:
  * **Undo Button** (`< Previous`): Reverts to prior state with zero drift. Disabled on Question 1.
  * **Certainty Progress Bar**: Displays calculated diagnostic certainty: Certainty = max(0, 1 - H(S)/log2(M)) * 100%.
  * **Question Counter Badge**: e.g., "Question 6 of ~10".
* **Question Card**:
  * **Category Pill**: Displays category icon and name (e.g. `🟣 THE SOUND`).
  * **Primary Question**: Bold, high-contrast, conversational text (e.g., *"Is there a prominent bubbling, squealing synthesizer that twists and shrieks in resonance?"*).
  * **Hint / Context Accordion**: Collapsible helper text (e.g., *"Like a Roland TB-303 in Acid House or Psytrance"*).
* **5 Ergonomic Response Buttons** (Full-width thumb-friendly stack on mobile, horizontal row on desktop):
  1. `[ Yes ]` (Value: `+1.0`, Green glow) — *Shortcut: Key 1*
  2. `[ Probably ]` (Value: `+0.5`, Light green) — *Shortcut: Key 2*
  3. `[ Don't Know / Unsure ]` (Value: `0.0`, Muted gray) — *Shortcut: Key 3*
  4. `[ Probably Not ]` (Value: `-0.5`, Light red) — *Shortcut: Key 4*
  5. `[ No ]` (Value: `-1.0`, Bright red) — *Shortcut: Key 5*

### View 3: Diagnosis Reveal (`CONVERGED`)
* **Celebration**: Trigger `canvas-confetti` explosion upon render.
* **Top Result Card**:
  * Large circular confidence gauge (e.g. `65% Match`).
  * Winning Genre Name in massive neon typography (e.g. **Tech House**).
  * 2-sentence non-technical layman vibe summary.
  * **Key Sensory Hallmarks**: Bullets highlighting why it won (The Pulse, The Sound, The Atmosphere).
* **Embedded Benchmark Track Player**:
  * Playable YouTube IFrame (or Spotify embed) of a landmark song for this genre (e.g., Fisher — *Losing It*).
* **Ranked Runner-Ups Accordion**:
  * Horizontal mini-bars showing #2 and #3 candidates (e.g., Acid House 20.4%, Deep House 16.8%).
* **Action CTAs**:
  * `[ 🔬 Pinpoint Exact Subgenre ]`: If diagnosis is at the macro level, launches the focused subgenre drill-down round.
  * `[ 🎧 Open in Spotify / Apple Music / YouTube ]`: Deep-search buttons.
  * `[ ❌ Wrong Genre? Teach Me ]`: Opens the crowdsourced feedback modal.
  * `[ 🔄 Play Again ]`: Resets the session state.

### View 4: Subgenre Drill-Down Round (`SUBGENRE_DRILLDOWN`)
* Transitions smoothly from the macro guess.
* Retains all previous answers as Bayesian priors.
* Restricts candidate pool to children of the winning macro genre (e.g., House -> Deep House, Acid House, Tech House, French Touch).
* Solves in 3–5 targeted micro questions.

### View 5: Crowdsource Correction Modal (`FEEDBACK`)
* Triggered when the user clicks "Wrong Genre? Teach Me".
* Searchable dropdown / text input where the user selects the true genre.
* Optional text area: "What sound gave it away?".
* Automatically submits full session trace (session ID, question sequence, answers, predicted vs actual) to Supabase.
* Displays grateful toast: *"Thanks for teaching me! Matrix will learn from your feedback."*

---

## 🧮 5. Algorithmic Core Specification (Pure TypeScript)

The engine must be implemented in clean, testable TypeScript under `src/engine/`.

### 1. Mathematical Formulas
- Popularity-Weighted Priors
- Clamped Bayesian Likelihood Update: L(u | g_i) = max(0.05, min(0.95, (1.0 + u * W_ij) / 2.0))
- Shannon Entropy & Information Gain
- Dynamic Instrumental Pruning: If response to voice_present is 'no', prune voice attributes
- Convergence Conditions: Top prob >= 0.65, margin > 0.35 after >= 3 questions, questions >= 15, or IG < 0.005.

---

## 💻 6. Production Engine Code

Implement the full `AkinatorEngine` class in `src/engine/engine.ts` supporting response values, entropy calculation, information gain question selection, Bayesian likelihood updates, undo rollback, and subgenre drilldown as specified.

Seed comprehensive mock datasets for `genres.json`, `attributes.json`, and `matrix.json` covering the major electronic, rock, hip-hop, jazz, and acoustic subgenres.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7ef51a5d-c83d-480c-831d-87df2d49c3ae).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# 🧞 Genre Genie

> Guess any music genre through intuitive, sensory questions — no music theory required.

**Genre Genie** is an interactive, 20-questions expert identification engine for music genres. Think of a song, listen to a track playing at a club or festival, and answer simple questions about what you perceive in real time. Genre Genie identifies the genre in about 10 taps.

---

## 🌟 How It Works

Traditional music identification tools (like Shazam) fail when a DJ plays an unreleased track, an ID, or a live bootleg. Meanwhile, music databases often use academic music theory terminology that non-musicians don't understand.

Genre Genie approaches music identification through **four sensory dimensions**:

1. 🟢 **The Pulse**: Speed, rhythm, kick drum pattern, syncopation, and kinetic body movement.
2. 🟣 **The Sound**: Tactile instrument textures (warm analog, distorted fuzz, acoustic wood, liquid 303 squelch).
3. 🔵 **The Voice**: Vocal delivery style (clean singing, rapping, whispered, screams, or purely instrumental).
4. 🟠 **The Atmosphere**: Spatial resonance and emotional mood (cavernous warehouse, intimate bedroom, melancholic dusk).

### Algorithmic Core
The engine runs **100% client-side** in TypeScript:
- **Maximum Information Gain (Shannon Entropy)**: Dynamically selects the next question that splits the remaining genre candidates most effectively.
- **Bayesian Likelihood Updates**: Updates belief distribution across all cataloged genres after each answer.
- **Instrumental Pruning**: Intelligently skips vocal questions when instrumental tracks are identified.
- **Subgenre Drilldown**: Seamlessly transitions from macro-level genres to specific micro-clusters.
- **Alternative Rephrasing**: If an attribute is marked "Unsure / Don't Know", the engine can rephrase using alternative sensory cues.

---

## 🛠️ Tech Stack

- **Framework**: React 19, [TanStack Start](https://tanstack.com/start) & [TanStack Router](https://tanstack.com/router)
- **Bundler & Server**: Vite, Nitro
- **Styling**: Tailwind CSS v4
- **Components**: Radix UI primitives, Lucide Icons, Canvas Confetti
- **Testing**: Vitest

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js >= 20

### Installation

```bash
git clone https://github.com/Sonotaxo/genre-genie.git
cd genre-genie
bun install
```

### Development

Start the local development server:

```bash
bun dev
```

### Running Tests

Run the engine test suite (verifying convergence across all genres and subgenres):

```bash
bun test
```

### Production Build

```bash
bun run build
```

---

## 🙏 Acknowledgments & Inspiration

This project was inspired by the original [Akinator](https://en.akinator.com/), adapting the classic 20-questions guessing game mechanics to sound perception, acoustic textures, and music genres.

---

## 📄 License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) — free for personal, educational, and research use. Commercial use, resale, and monetized distribution are strictly prohibited.

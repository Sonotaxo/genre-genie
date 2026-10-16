import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ChevronLeft, RotateCcw, Microscope, X, ChevronDown, Music2, Youtube, ExternalLink, Github, Search, HelpCircle, Check, Bug, Copy } from "lucide-react";
import { AkinatorEngine, RESPONSES, hasSubgenres, type Answer } from "@/engine/engine";
import { DescriptorEngine, type DescriptorQuestion } from "@/engine/descriptor-engine";
import { ATTRIBUTES, CATEGORY_META, FAMILIES, GENRES, type Category, type Family, type Genre } from "@/engine/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type Screen = "IDLE" | "PLAYING" | "CONVERGED";

const CAT_CLASS: Record<Category, { text: string; border: string; bg: string }> = {
  pulse: { text: "text-pulse", border: "border-pulse/50", bg: "bg-pulse/10" },
  sound: { text: "text-sound", border: "border-sound/50", bg: "bg-sound/10" },
  voice: { text: "text-voice", border: "border-voice/50", bg: "bg-voice/10" },
  atmosphere: { text: "text-atmos", border: "border-atmos/50", bg: "bg-atmos/10" },
};

const RESP_CLASS = [
  "border-pulse bg-pulse/20 hover:bg-pulse/30 shadow-[0_0_20px_-4px_var(--pulse)]",
  "border-pulse/40 bg-pulse/10 hover:bg-pulse/20",
  "border-border bg-muted hover:bg-accent text-muted-foreground",
  "border-destructive/40 bg-destructive/10 hover:bg-destructive/20",
  "border-destructive bg-destructive/20 hover:bg-destructive/30 shadow-[0_0_20px_-4px_var(--destructive)]",
];

const RESP_BORDER = [
  "border-pulse",
  "border-pulse/40",
  "border-border",
  "border-destructive/40",
  "border-destructive",
];

function Wave({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 h-5 ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="wave-bar w-1 h-full rounded bg-current" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

export function GenreGenie() {
  const [engineMode, setEngineMode] = useState<"descriptor" | "standard">("descriptor");
  const engineRef = useRef<AkinatorEngine | null>(null);
  const descriptorEngineRef = useRef<DescriptorEngine | null>(null);
  const descriptorMacroRef = useRef<DescriptorEngine | null>(null);
  const macroRef = useRef<AkinatorEngine | null>(null);
  const autoDrillRef = useRef(false);
  const [screen, setScreen] = useState<Screen>("IDLE");
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [drill, setDrill] = useState<string | null>(null);
  const [macroAnswers, setMacroAnswers] = useState<Answer[]>([]);
  const [hintOpen, setHintOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("genre_genie_show_hints");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleSetHintOpen = useCallback((open: boolean) => {
    setHintOpen(open);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("genre_genie_show_hints", String(open));
      } catch {}
    }
  }, []);

  const engine = engineRef.current;
  const question = screen === "PLAYING" && engine ? engine.nextQuestion() : null;

  const descriptorEngine = descriptorEngineRef.current;
  const descriptorQuestion =
    screen === "PLAYING" && engineMode === "descriptor" && descriptorEngine
      ? descriptorEngine.nextQuestion()
      : null;

  const start = (family?: Family) => {
    if (engineMode === "descriptor") {
      descriptorEngineRef.current = new DescriptorEngine(
        family ? { genres: GENRES.filter((g) => g.family === family) } : {}
      );
      descriptorMacroRef.current = null;
    }
    engineRef.current = new AkinatorEngine(family ? { family } : {});
    setDrill(null);
    setMacroAnswers([]);
    setScreen("PLAYING");
    force();
  };

  const respondDescriptor = useCallback((optionId: string) => {
    const d = descriptorEngineRef.current;
    const q = d?.nextQuestion();
    if (!d || !q) return;

    d.answer(q.id, optionId);

    const maxQ = drill ? 14 : 10;
    if (d.isConverged(maxQ) || !d.nextQuestion()) {
      setScreen("CONVERGED");
    }
    force();
  }, [drill]);

  const undoDescriptor = useCallback(() => {
    const d = descriptorEngineRef.current;
    if (!d) return;
    if (drill && !d.canUndo && descriptorMacroRef.current) {
      descriptorEngineRef.current = descriptorMacroRef.current;
      descriptorMacroRef.current = null;
      setDrill(null);
      setScreen("CONVERGED");
      force();
      return;
    }
    d.undo();
    setScreen("PLAYING");
    force();
  }, [drill]);

  const selectGenreEarlyDescriptor = useCallback((genreId: string) => {
    const d = descriptorEngineRef.current;
    if (!d) return;
    const targetGenre = GENRES.find((g) => g.id === genreId);
    if (!targetGenre) return;

    const idx = d.candidates.findIndex((c) => c.id === genreId);
    if (idx !== -1) {
      d.probs = d.probs.map((_, i) => (i === idx ? 0.96 : 0.04 / Math.max(d.probs.length - 1, 1)));
    } else {
      d.candidates = [targetGenre, ...d.candidates.filter((c) => c.id !== targetGenre.id)];
      d.probs = [0.96, ...d.candidates.slice(1).map(() => 0.04 / Math.max(d.candidates.length - 1, 1))];
    }
    setScreen("CONVERGED");
    toast.success(`Identified as ${targetGenre.name}!`);
    force();
  }, []);

  const exitDrill = useCallback(() => {
    if (engineMode === "descriptor") {
      if (descriptorMacroRef.current) {
        descriptorEngineRef.current = descriptorMacroRef.current;
        descriptorMacroRef.current = null;
      }
      setDrill(null);
      setScreen("CONVERGED");
      toast.info("Returned to overall genre match.");
      force();
      return;
    }
    if (macroRef.current) {
      engineRef.current = macroRef.current;
      setDrill(null);
      setMacroAnswers([]);
      setScreen("CONVERGED");
      toast.info("Returned to overall genre match.");
      force();
    }
  }, [engineMode]);

  const flipDescriptorAnswer = useCallback((questionId: string, newOptionId: string) => {
    const d = descriptorEngineRef.current;
    if (!d) return;

    const updated = d.updateAnswer(questionId, newOptionId);
    if (!updated) return;

    if (drill && descriptorMacroRef.current) {
      descriptorMacroRef.current.updateAnswer(questionId, newOptionId);
      const newMacroTop = descriptorMacroRef.current.ranked()[0]?.genre;
      if (newMacroTop && newMacroTop.id !== drill && newMacroTop.parent !== drill) {
        // The updated answer points outside the drilled family; return to the full genre pool
        descriptorEngineRef.current = descriptorMacroRef.current;
        descriptorMacroRef.current = null;
        setDrill(null);
      }
    }

    const active = descriptorEngineRef.current;
    const maxQ = drill ? 14 : 10;
    if (screen === "CONVERGED" && active && !active.isConverged(maxQ) && active.nextQuestion()) {
      setScreen("PLAYING");
    }

    toast.success("Recalculated with updated answer!");
    force();
  }, [drill, screen]);

  const flipAnswer = useCallback((attrId: string, newValue: number) => {
    if (engineMode === "descriptor") {
      const d = descriptorEngineRef.current;
      if (!d) return;
      const top = d.ranked()[0]?.genre;
      const tension = top ? d.computeTension(top) : null;
      if (tension?.outlier?.descriptorQuestionId && tension.outlier.suggestedOptionId) {
        flipDescriptorAnswer(tension.outlier.descriptorQuestionId, tension.outlier.suggestedOptionId);
      }
      return;
    }

    const e = engineRef.current;
    if (!e) return;
    const ans = e.answers.find((a) => a.attributeId === attrId);
    if (!ans) return;

    ans.value = newValue;
    e.recalculate();

    if (drill && macroRef.current) {
      const macroAns = macroRef.current.answers.find((a) => a.attributeId === attrId);
      if (macroAns) {
        macroAns.value = newValue;
        macroRef.current.recalculate();
        const newMacroTop = macroRef.current.ranked()[0]?.genre;
        if (newMacroTop && newMacroTop.id !== drill) {
          // Macro genre changed from the flipped answer!
          if (hasSubgenres(newMacroTop.id)) {
            const newDrill = makeDrill(newMacroTop.id, macroRef.current.answers);
            engineRef.current = newDrill;
            setDrill(newMacroTop.id);
            if (!newDrill.isConverged(8 + macroRef.current.answers.length)) {
              setScreen("PLAYING");
            }
          } else {
            engineRef.current = macroRef.current;
            setDrill(null);
            setMacroAnswers([]);
            if (!macroRef.current.isConverged(25)) {
              setScreen("PLAYING");
            }
          }
        }
      }
    }

    const activeEngine = engineRef.current;
    const limit = drill ? 8 + macroAnswers.length : 25;
    if (activeEngine && !activeEngine.isConverged(limit)) {
      setScreen("PLAYING");
    }

    toast.success("Recalculated with updated answer!");
    force();
  }, [drill, macroAnswers.length, engineMode, flipDescriptorAnswer]);

  const makeDrill = (parent: string, prior: Answer[]) => {
    const e = new AkinatorEngine({
      parent,
      priorAnswers: prior,
      allowCrossFamilySubgenres: true,
    });
    e.answers = prior.map((a) => ({ ...a }));
    return e;
  };

  const makeSubgenreDrill = (macroE: AkinatorEngine) => {
    const macroProbs = new Map(macroE.ranked().map((r) => [r.genre.id, r.prob]));
    const e = new AkinatorEngine({
      macroProbs,
      priorAnswers: macroE.answers,
    });
    e.answers = macroE.answers.map((a) => ({ ...a }));
    return e;
  };

  const respond = useCallback((value: number, isAlt?: boolean) => {
    const e = engineRef.current;
    const q = e?.nextQuestion();
    if (!e || !q) return;
    e.answer(q.attribute.id, value, isAlt ?? q.isAlternative ?? false);

    if (drill) {
      // In subgenre mode
      const limit = Math.min(8 + macroAnswers.length, 25);
      if (e.isConverged(limit)) {
        setScreen("CONVERGED");
      }
    } else {
      // In macro mode
      const macroRanked = e.ranked();
      const topMacro = macroRanked[0];
      const secondMacro = macroRanked[1];
      const viableMacroWithSubgenres = macroRanked
        .slice(0, 3)
        .filter((r) => r.prob >= 0.05 && hasSubgenres(r.genre.id));

      const macroConverged = e.isConverged(20);
      const isMacroAmbiguous =
        topMacro &&
        secondMacro &&
        (topMacro.prob < 0.82 || topMacro.prob - secondMacro.prob < 0.35);
      const subgenreLeading = e.rankedAllSubgenres()[0];
      const isCrossFamilySubgenreLeading =
        subgenreLeading &&
        topMacro &&
        subgenreLeading.genre.parent !== topMacro.genre.id &&
        subgenreLeading.prob >= 0.25;

      // When it's unclear which main genre we're in because multiple subgenres could match,
      // or when the macro round reaches convergence and subgenres are in play:
      // DO NOT present the main genre! Instead, seamlessly continue drilling down the sub-genre.
      const shouldDrillSubgenres =
        viableMacroWithSubgenres.length >= 1 &&
        (macroConverged ||
          (e.questionCount >= 8 && (isMacroAmbiguous || isCrossFamilySubgenreLeading)));

      if (shouldDrillSubgenres) {
        const prior = [...e.answers];
        const subEngine = makeSubgenreDrill(e);
        setMacroAnswers(prior);
        macroRef.current = e;
        engineRef.current = subEngine;
        autoDrillRef.current = true;
        setDrill(subEngine.ranked()[0]?.genre.parent ?? topMacro?.genre.id ?? "subgenres");

        // If the subgenre is already decisively clear from the answers, show it directly:
        if (subEngine.isClear() || subEngine.isConverged(Math.min(8 + prior.length, 25))) {
          setScreen("CONVERGED");
        } else {
          // Seamlessly continue drilling down without stopping:
          setScreen("PLAYING");
        }
      } else if (macroConverged) {
        // Macro converged and no subgenres exist for this style (e.g. Flamenco, Delta Blues)
        setScreen("CONVERGED");
      }
    }
    force();
  }, [drill, macroAnswers.length]);

  const undo = () => {
    const e = engineRef.current;
    if (e && drill && !e.canUndo) {
      // stepping back out of an auto-resolved subgenre: rebuild the macro round
      // leave the subgenre round: auto-resolved goes back one macro question,
      // a manual drill-down returns to the macro result
      const m = macroRef.current;
      engineRef.current = m;
      setDrill(null);
      setMacroAnswers([]);
      if (autoDrillRef.current) m?.undo();
      else { setScreen("CONVERGED"); force(); return; }
    } else e?.undo();
    setScreen("PLAYING");
    force();
  };

  const startDrill = (parent: string) => {
    if (engineMode === "descriptor") {
      const d = descriptorEngineRef.current;
      if (!d) return;
      descriptorMacroRef.current = d;
      const subEngine = new DescriptorEngine({
        genres: GENRES.filter((g) => g.parent === parent || g.id === parent),
        priorDescriptorAnswers: [...d.descriptorAnswers],
      });
      descriptorEngineRef.current = subEngine;
      setDrill(parent);
      const nextQ = subEngine.nextQuestion();
      if (nextQ && !subEngine.isConverged(Math.min(4 + d.questionCount, 14))) {
        setScreen("PLAYING");
      } else {
        setScreen("CONVERGED");
        toast.info(`Pinpointed to ${subEngine.ranked()[0]?.genre.name}`);
      }
      force();
      return;
    }

    const prior = [...(engineRef.current?.answers ?? [])];
    setMacroAnswers(prior);
    macroRef.current = engineRef.current;
    autoDrillRef.current = false;
    const subEngine = makeDrill(parent, prior);
    engineRef.current = subEngine;
    setDrill(parent);

    const next = subEngine.nextQuestion();
    if (next && next.gain >= 0.005) {
      setScreen("PLAYING");
    } else {
      setScreen("CONVERGED");
      toast.info(`Pinpointed to ${subEngine.ranked()[0]?.genre.name}`);
    }
    force();
  };

  const isLocalDev =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.endsWith(".local")));

  const copyDevSnapshot = useCallback(() => {
    const activeEngine = engineMode === "descriptor" ? descriptorEngineRef.current : engineRef.current;
    if (!activeEngine) {
      toast.error("No active engine to inspect.");
      return;
    }

    const ranked = activeEngine.ranked();
    const top = ranked[0];
    const allSubs = activeEngine.rankedAllSubgenres();
    const nextQ = screen === "PLAYING" ? activeEngine.nextQuestion() : null;
    const tension = top ? activeEngine.computeTension(top.genre) : null;

    let traceText = "";
    if (engineMode === "descriptor") {
      const d = descriptorEngineRef.current;
      traceText = (d?.descriptorAnswers ?? [])
        .map((a, i) => {
          const q = d?.questions.find((x) => x.id === a.questionId);
          const opt = q?.options.find((o) => o.id === a.optionId);
          return `| ${i + 1} | \`${a.questionId}\` | **${opt?.label ?? a.optionId}** (${opt?.emoji ?? ""}) | ${q?.question ?? ""} |`;
        })
        .join("\n");
    } else {
      const e = engineRef.current;
      traceText = (e?.answers ?? [])
        .map((a, i) => {
          const resp = RESPONSES.find((r) => r.value === a.value)?.label ?? String(a.value);
          const attr = ATTRIBUTES.find((x) => x.id === a.attributeId);
          return `| ${i + 1} | \`${a.attributeId}\` | **${resp}** (\`${a.value}\`) | ${attr?.question ?? ""} |`;
        })
        .join("\n");
    }

    const lines = [
      `### 🛠️ Genre Genie Dev Diagnostic Snapshot`,
      ``,
      `- **Timestamp**: ${new Date().toISOString()}`,
      `- **Screen**: \`${screen}\``,
      `- **Engine Mode**: \`${engineMode}\``,
      `- **Drill Target**: \`${drill ?? "none"}\`${drill ? ` (${GENRES.find((g) => g.id === drill)?.name ?? drill})` : ""}`,
      `- **Auto-Drill Active**: \`${autoDrillRef.current}\``,
      `- **Total Questions Asked**: ${activeEngine.questionCount}`,
      `- **Engine Certainty**: ${Math.round(activeEngine.certainty() * 100)}%`,
      `- **Top Predicted Genre**: **${top?.genre.name ?? "None"}** (${top ? (top.prob * 100).toFixed(1) : 0}%)`,
      ``,
      `#### 📊 Top 5 Candidates`,
      ...ranked.slice(0, 5).map((r, i) => `${i + 1}. **${r.genre.name}**: ${(r.prob * 100).toFixed(1)}%${r.genre.parent ? ` *(subgenre of ${r.genre.parent})*` : ""}`),
      ``,
      `#### 🔬 Top 5 Subgenres Across All Families`,
      ...allSubs.slice(0, 5).map((r, i) => `${i + 1}. **${r.genre.name}**: ${(r.prob * 100).toFixed(1)}%${r.genre.parent ? ` *(parent: ${r.genre.parent})*` : ""}`),
      ``,
    ];

    if (nextQ) {
      lines.push(
        `#### ❓ Next Question`,
        `- **Question**: ${"attribute" in nextQ ? nextQ.attribute.question : nextQ.question}`,
        `- **Category**: ${"attribute" in nextQ ? nextQ.attribute.category : nextQ.category}`,
        `- **Attribute / Question ID**: \`${"attribute" in nextQ ? nextQ.attribute.id : nextQ.id}\``,
        `- **Information Gain**: ${"gain" in nextQ ? (nextQ.gain as number).toFixed(4) : "N/A"}`,
        ``
      );
    }

    if (tension?.outlier) {
      lines.push(
        `#### ⚠️ Detected Contradiction / Outlier`,
        `- **Attribute**: \`${tension.outlier.attributeId}\` (*${tension.outlier.attribute.question}*)`,
        `- **Actual Listener Answer**: \`${tension.outlier.actual}\``,
        `- **Expected For ${top?.genre.name}**: \`${tension.outlier.expected}\``,
        `- **Contradiction Delta**: \`${tension.outlier.delta.toFixed(2)}\``,
        ``
      );
    }

    lines.push(
      `#### 🔍 Question & Answer Trace (${activeEngine.questionCount} questions)`,
      `| # | Attribute ID | Answer | Question Text |`,
      `|---|---|---|---|`,
      traceText || "| - | *No answers recorded* | - | - |",
      ``
    );

    const snapshot = lines.join("\n");
    navigator.clipboard.writeText(snapshot).then(
      () => {
        toast.success("Dev diagnostic snapshot copied to clipboard!");
      },
      (err) => {
        console.error("Failed to copy dev snapshot", err);
        toast.error("Failed to copy snapshot to clipboard");
      }
    );
  }, [engineMode, screen, drill]);

  const selectGenreEarly = useCallback((genreId: string) => {
    const e = engineRef.current;
    if (!e) return;

    const targetGenre = GENRES.find((g) => g.id === genreId);
    if (!targetGenre) return;

    if (targetGenre.parent && !drill) {
      setDrill(targetGenre.parent);
    }

    const idx = e.candidates.findIndex((c) => c.id === genreId);
    if (idx !== -1) {
      e.probs = e.probs.map((_, i) => (i === idx ? 0.96 : 0.04 / Math.max(e.probs.length - 1, 1)));
    } else {
      e.candidates = [targetGenre, ...e.candidates.filter((c) => c.id !== targetGenre.id)];
      e.probs = [0.96, ...e.candidates.slice(1).map(() => 0.04 / Math.max(e.candidates.length - 1, 1))];
      if (targetGenre.parent) {
        setDrill(targetGenre.parent);
      }
    }

    setScreen("CONVERGED");
    toast.success(`Identified as ${targetGenre.name}!`);
    force();
  }, [drill]);

  useEffect(() => {
    if (screen !== "PLAYING") return;
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (ev.key === "Backspace") {
        if (engineMode === "descriptor") undoDescriptor();
        else undo();
        return;
      }

      if (engineMode === "descriptor") {
        const d = descriptorEngineRef.current;
        const q = d?.nextQuestion();
        if (!d || !q) return;
        const n = Number(ev.key);
        if (!isNaN(n) && n >= 1 && n <= Math.min(4, q.options.length)) {
          respondDescriptor(q.options[n - 1]!.id);
        }
        return;
      }
      const n = Number(ev.key);
      if (n >= 1 && n <= 5) respond(RESPONSES[n - 1]!.value, question?.isAlternative ?? false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, respond, respondDescriptor, question, engineMode, undoDescriptor]);

  const activeCategory: Category =
    screen === "PLAYING"
      ? engineMode === "descriptor"
        ? (descriptorQuestion?.category ?? "sound")
        : (question?.attribute.category ?? "sound")
      : "pulse";

  const auraColorVar =
    activeCategory === "pulse"
      ? "var(--pulse)"
      : activeCategory === "sound"
      ? "var(--sound)"
      : activeCategory === "voice"
      ? "var(--voice)"
      : "var(--atmos)";

  return (
    <main className="relative mx-auto max-w-4xl px-3.5 py-4 sm:px-6 sm:py-8 md:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[440px] transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 75% 55% at 50% -10%, color-mix(in oklch, ${auraColorVar} 22%, transparent), transparent 70%)`,
        }}
      />

      <header className="mb-4 flex items-center justify-between gap-2 sm:mb-8">
        <button
          onClick={() => setScreen("IDLE")}
          className="flex items-center gap-2 text-base font-extrabold tracking-tight transition hover:opacity-90 active:scale-95 sm:text-lg"
        >
          <Wave className="text-pulse" />
          <span>Genre Genie</span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 rounded-full border border-border/80 bg-card/80 p-0.5 font-mono text-[11px] backdrop-blur sm:text-xs">
            <button
              type="button"
              onClick={() => {
                setEngineMode("descriptor");
                setScreen("IDLE");
              }}
              className={`rounded-full px-2.5 py-1 transition ${
                engineMode === "descriptor"
                  ? "bg-pulse font-bold text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🧪 <span className="hidden sm:inline">Descriptors</span>
              <span className="sm:hidden">Sensory</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEngineMode("standard");
                setScreen("IDLE");
              }}
              className={`rounded-full px-2.5 py-1 transition ${
                engineMode === "standard"
                  ? "bg-muted font-bold text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">Standard (Yes/No)</span>
              <span className="sm:hidden">Yes/No</span>
            </button>
          </div>
          {isLocalDev && (
            <button
              type="button"
              onClick={copyDevSnapshot}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-amber-500 transition hover:bg-amber-500/20 active:scale-95"
              title="Copy full diagnostic session snapshot to clipboard for AI debugging"
            >
              <Bug className="size-3.5" />
              <span className="hidden md:inline">Dev Copy State</span>
            </button>
          )}
          <a
            href="https://github.com/Sonotaxo/genre-genie"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-2.5 py-1 font-mono text-xs text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-foreground active:scale-95 sm:px-3"
            title="View on GitHub"
          >
            <Github className="size-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      {screen === "IDLE" && <Landing onStart={start} engineMode={engineMode} />}
      {screen === "PLAYING" && engineMode === "descriptor" && descriptorEngine && descriptorQuestion && (
        <DescriptorQuestionView
          key={descriptorEngine.questionCount + (drill ?? "")}
          engine={descriptorEngine}
          q={descriptorQuestion}
          drill={drill}
          onRespond={respondDescriptor}
          onUndo={undoDescriptor}
          onSelectGenre={selectGenreEarlyDescriptor}
          onChangeDescriptorAnswer={flipDescriptorAnswer}
        />
      )}
      {screen === "PLAYING" && engineMode === "standard" && engine && question && (
        <QuestionView
          key={engine.questionCount + (drill ?? "")}
          engine={engine}
          q={question.attribute}
          isAlternative={question.isAlternative ?? false}
          isConfirming={question.isConfirming ?? false}
          suspectName={question.suspectName}
          drill={drill}
          baseCount={macroAnswers.length}
          hintOpen={hintOpen}
          setHintOpen={handleSetHintOpen}
          onRespond={respond}
          onUndo={undo}
          onSelectGenre={selectGenreEarly}
          onFlipAnswer={flipAnswer}
        />
      )}
      {screen === "CONVERGED" && (
        <Diagnosis
          key={drill ?? "macro"}
          engine={(engineMode === "descriptor" ? descriptorEngine : engine)!}
          drill={drill}
          onDrill={startDrill}
          onExitDrill={exitDrill}
          onAgain={() => setScreen("IDLE")}
          onUndo={engineMode === "descriptor" ? undoDescriptor : undo}
          onWrong={() => setFeedbackOpen(true)}
          onFlipAnswer={flipAnswer}
          onChangeDescriptorAnswer={flipDescriptorAnswer}
          onCopyDevSnapshot={copyDevSnapshot}
          isLocalDev={isLocalDev}
        />
      )}
      {(engineMode === "descriptor" ? descriptorEngine : engine) && (
        <FeedbackModal
          open={feedbackOpen}
          onOpenChange={setFeedbackOpen}
          engine={(engineMode === "descriptor" ? descriptorEngine : engine)!}
        />
      )}
    </main>
  );
}

export const AudioAkinator = GenreGenie;

function Landing({
  onStart,
  engineMode,
}: {
  onStart: (f?: Family) => void;
  engineMode: "descriptor" | "standard";
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <section className="animate-slide-in pt-2 text-center sm:pt-4">
      <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-pulse/35 bg-pulse/10 px-3.5 py-1 text-[11px] font-semibold text-pulse sm:mb-6 sm:text-xs">
        <span>{engineMode === "descriptor" ? "🎧 Sensory Sound Profiles" : "🎛️ Classic Yes / No Mode"}</span>
        <span className="opacity-50">•</span>
        <span>{GENRES.length} Genres & Subgenres</span>
      </div>
      <h1 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
        Think of a song or listen to the music playing.{" "}
        <span className="bg-gradient-to-r from-pulse via-voice to-sound bg-clip-text text-transparent">
          Genre Genie will guess its genre.
        </span>
      </h1>
      <p className="mx-auto mt-3.5 max-w-xl text-pretty text-sm text-muted-foreground sm:mt-5 sm:text-base">
        No music theory needed. Just answer simple questions about what you hear and feel.
      </p>
      <div className="mt-7 sm:mt-9">
        <Button
          size="lg"
          onClick={() => onStart()}
          disabled={!ready}
          className="h-14 w-full rounded-2xl px-10 text-base font-extrabold shadow-[0_0_40px_-6px_var(--pulse)] transition-transform duration-100 active:scale-95 sm:h-16 sm:w-auto sm:min-w-[260px] sm:text-lg"
        >
          <Wave /> {ready ? "Start Guessing" : "Loading…"}
        </Button>
      </div>
      <div className="mt-9 sm:mt-12">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:text-xs">
          or fast-track a musical family
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => onStart(f.id)}
              disabled={!ready}
              className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card/65 px-3.5 py-2.5 text-left text-xs font-semibold backdrop-blur transition hover:border-pulse/60 hover:bg-card active:scale-[0.98] disabled:opacity-50 sm:text-sm"
            >
              <span className="text-base sm:text-lg">{f.emoji}</span>
              <span className="truncate">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <SupportedGenresCatalog onStartFamily={(f) => onStart(f)} />

      <div className="mt-14 flex flex-col items-center gap-3 border-t border-border/50 pt-8 text-center sm:mt-16">
        <a
          href="https://github.com/Sonotaxo/genre-genie"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-4 py-2 font-mono text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-primary hover:text-foreground active:scale-95"
        >
          <Github className="size-4" />
          <span>Open Source on GitHub</span>
        </a>
        <p className="font-mono text-[11px] text-muted-foreground sm:text-xs">
          {GENRES.length} Genres Cataloged • {ATTRIBUTES.length} Sensory Attributes • 100% In-Browser Engine
        </p>
      </div>
    </section>
  );
}

function GenreProfileDialog({
  genre,
  open,
  onOpenChange,
}: {
  genre: Genre | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!genre) return null;
  const parentGenre = genre.parent ? GENRES.find((x) => x.id === genre.parent) : null;
  const familyMeta = FAMILIES.find((f) => f.id === genre.family);
  const hallmarks = (["pulse", "sound", "atmosphere", "voice"] as Category[])
    .filter((cat) => Boolean(genre.sensoryHallmarks?.[cat]))
    .map((cat) => [cat, genre.sensoryHallmarks[cat]] as [Category, string]);
  const tracks = genre.benchmarkTracks?.length ? genre.benchmarkTracks : [genre.benchmark];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted-foreground">
            {familyMeta && (
              <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5">
                {familyMeta.emoji} {familyMeta.label}
              </span>
            )}
            {parentGenre && (
              <span className="rounded-full border border-sound/40 bg-sound/10 px-2.5 py-0.5 text-sound">
                Subgenre of {parentGenre.name}
              </span>
            )}
          </div>
          <DialogTitle className="mt-1 text-balance text-2xl font-extrabold tracking-tight">
            {genre.name}
          </DialogTitle>
          {genre.aliases && genre.aliases.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Also known as:{" "}
              <span className="font-medium text-foreground/90">{genre.aliases.join(" • ")}</span>
            </p>
          )}
          <DialogDescription className="pt-1 text-pretty text-sm leading-relaxed text-foreground/90">
            {genre.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {hallmarks.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {hallmarks.map(([cat, text]) => (
                <div
                  key={cat}
                  className={`rounded-xl border ${CAT_CLASS[cat].border} ${CAT_CLASS[cat].bg} p-3 text-xs`}
                >
                  <span className={`font-mono text-[10px] font-bold uppercase ${CAT_CLASS[cat].text}`}>
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                  </span>
                  <p className="mt-1 leading-relaxed text-foreground/90">{text}</p>
                </div>
              ))}
            </div>
          )}

          {genre.distinctionNotes && (
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-pulse">
                🧭 How to Tell It Apart
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{genre.distinctionNotes}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card/60 p-3.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              🎧 Benchmark Tracks ({tracks.length})
            </p>
            <div className="mt-2.5 space-y-2">
              {tracks.map((t, idx) => {
                const q = encodeURIComponent(`${t.artist} ${t.title}`);
                return (
                  <div
                    key={`${t.artist}-${t.title}-${idx}`}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5 text-xs sm:flex-row sm:items-center"
                  >
                    <div className="font-semibold text-foreground">
                      <span className="mr-2 font-mono text-[10px] text-muted-foreground">
                        0{idx + 1}
                      </span>
                      {t.artist} — <span className="italic font-normal text-muted-foreground">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`https://open.spotify.com/search/${q}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] transition hover:border-pulse hover:text-pulse"
                      >
                        Spotify
                      </a>
                      <a
                        href={`https://music.apple.com/search?term=${q}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] transition hover:border-pulse hover:text-pulse"
                      >
                        Apple
                      </a>
                      <a
                        href={`https://www.youtube.com/results?search_query=${q}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] transition hover:border-pulse hover:text-pulse"
                      >
                        YouTube
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupportedGenresCatalog({ onStartFamily }: { onStartFamily: (f: Family) => void }) {
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<Family | "all">("all");
  const [inspectedGenre, setInspectedGenre] = useState<Genre | null>(null);

  const familyGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const macroGenres = GENRES.filter((g) => g.tier === "macro" || !g.parent);
    const subgenres = GENRES.filter((g) => g.tier === "micro" || g.parent);

    return FAMILIES.filter((fam) => activeFamily === "all" || fam.id === activeFamily)
      .map((fam) => {
        const famMacros = macroGenres.filter((g) => g.family === fam.id);

        const parentGroups = famMacros.map((parent) => {
          const subs = subgenres.filter((s) => s.parent === parent.id);
          return { parent, subgenres: subs };
        });

        if (!q) {
          return {
            family: fam,
            groups: parentGroups,
            totalCount: parentGroups.reduce((acc, g) => acc + 1 + g.subgenres.length, 0),
          };
        }

        const matchingGroups = parentGroups
          .map(({ parent, subgenres }) => {
            const parentMatches =
              parent.name.toLowerCase().includes(q) ||
              parent.aliases?.some((a) => a.toLowerCase().includes(q));
            const matchingSubs = subgenres.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                s.aliases?.some((a) => a.toLowerCase().includes(q))
            );
            if (parentMatches) {
              return { parent, subgenres };
            }
            if (matchingSubs.length > 0) {
              return { parent, subgenres: matchingSubs };
            }
            return null;
          })
          .filter((g): g is NonNullable<typeof g> => g !== null);

        return {
          family: fam,
          groups: matchingGroups,
          totalCount: matchingGroups.reduce((acc, g) => acc + 1 + g.subgenres.length, 0),
        };
      })
      .filter((f) => f.groups.length > 0);
  }, [search, activeFamily]);

  return (
    <div className="mt-14 border-t border-border/50 pt-10 text-left sm:mt-20 sm:pt-12">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            Supported Genres & Subgenres
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Tap any genre to inspect its sound profile, hallmarks & benchmark tracks.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search genres, subgenres, aliases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl bg-card/70 pl-9 pr-8 text-base sm:h-9 sm:text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Family Filter Bar for fast mobile browsing */}
      <div className="no-scrollbar -mx-1 mb-5 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setActiveFamily("all")}
          className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition active:scale-95 ${
            activeFamily === "all"
              ? "border-pulse bg-pulse/15 text-pulse"
              : "border-border/70 bg-card/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({GENRES.length})
        </button>
        {FAMILIES.map((fam) => {
          const isSelected = activeFamily === fam.id;
          return (
            <button
              key={fam.id}
              type="button"
              onClick={() => setActiveFamily(isSelected ? "all" : fam.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                isSelected
                  ? "border-pulse bg-pulse/15 font-semibold text-pulse"
                  : "border-border/70 bg-card/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {fam.emoji} {fam.label}
            </button>
          );
        })}
      </div>

      {familyGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          <p className="text-sm">No genres found matching &ldquo;{search}&rdquo;</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setActiveFamily("all");
            }}
            className="mt-2 text-xs"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {familyGroups.map(({ family, groups, totalCount }) => (
            <div
              key={family.id}
              className="glass-panel flex flex-col justify-between rounded-2xl border border-border/80 p-4 transition-all duration-200 hover:border-border sm:p-5"
            >
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
                    <span className="text-base">{family.emoji}</span>
                    <span>{family.label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {totalCount}
                    </span>
                  </div>
                  <button
                    onClick={() => onStartFamily(family.id)}
                    className="flex items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-pulse/50 hover:text-pulse active:scale-95"
                    title={`Fast-track ${family.label}`}
                  >
                    <span>Fast-track</span>
                    <span>→</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {groups.map(({ parent, subgenres }) => (
                    <div key={parent.id} className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectedGenre(parent)}
                          className="rounded-lg border border-transparent px-1.5 py-0.5 -ml-1.5 text-left text-xs font-semibold text-foreground/95 transition hover:border-pulse/40 hover:bg-pulse/10 hover:text-pulse active:scale-95"
                          title={`Explore ${parent.name} sound profile`}
                        >
                          {parent.name}
                        </button>
                        {subgenres.length > 0 && (
                          <span className="rounded-full border border-pulse/30 bg-pulse/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-pulse">
                            {subgenres.length} subgenres
                          </span>
                        )}
                      </div>

                      {subgenres.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 border-l-2 border-border/60 pl-2.5">
                          {subgenres.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setInspectedGenre(sub)}
                              className="rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-pulse/60 hover:text-foreground active:scale-95"
                              title={`Explore ${sub.name} sound profile`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <GenreProfileDialog
        genre={inspectedGenre}
        open={Boolean(inspectedGenre)}
        onOpenChange={(open) => {
          if (!open) setInspectedGenre(null);
        }}
      />
    </div>
  );
}

function CandidateCard({
  title,
  candidates,
  canEarlySelect,
  onSelectGenre,
  showParentTag = false,
}: {
  title: string;
  candidates: { genre: Genre; prob: number }[];
  canEarlySelect: boolean;
  onSelectGenre?: ((genreId: string) => void) | undefined;
  showParentTag?: boolean | undefined;
}) {
  const top = candidates[0];

  return (
    <div className="glass-panel flex flex-col justify-between rounded-2xl border border-border/80 p-3.5 sm:p-4">
      <div>
        {canEarlySelect && top && onSelectGenre && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-pulse/40 bg-pulse/10 px-3 py-2">
            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-sm shrink-0">🎯</span>
              <span className="truncate text-muted-foreground">
                Is it <strong className="text-foreground">{top.genre.name}</strong>?
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onSelectGenre(top.genre.id)}
              className="h-7 shrink-0 bg-pulse px-2.5 text-xs font-semibold text-primary-foreground hover:bg-pulse/90 active:scale-95"
            >
              <Check className="mr-1 size-3.5" />
              Yes, that&apos;s it!
            </Button>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{title}</p>
          {canEarlySelect && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-pulse">Leading match</span>
          )}
        </div>

        <div className="space-y-1.5">
          {candidates.slice(0, 3).map((r) => {
            const parentName =
              showParentTag && r.genre.parent
                ? GENRES.find((g) => g.id === r.genre.parent)?.name
                : null;
            return (
              <div key={r.genre.id} className="flex items-center gap-2.5 text-xs sm:text-sm">
                <div className="w-36 sm:w-44 truncate font-semibold" title={r.genre.name}>
                  <span>{r.genre.name}</span>
                  {parentName && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      ({parentName})
                    </span>
                  )}
                </div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-pulse to-voice transition-all duration-500"
                    style={{ width: `${Math.min(r.prob * 100, 100)}%` }}
                  />
                </div>
                <span className="w-11 text-right font-mono text-[11px] text-muted-foreground">
                  {(r.prob * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function checkEarlySelect(
  candidates: { genre: Genre; prob: number }[],
  questionCount: number
): boolean {
  if (candidates.length === 0 || questionCount < 4) return false;
  const top = candidates[0];
  const second = candidates[1];
  if (!top || top.prob < 0.35) return false;
  if (!second) return true;
  return top.prob - second.prob >= 0.20 || top.prob >= second.prob * 2.0;
}

function AnswerTrail({
  engine,
  onFlipAnswer,
  onChangeDescriptorAnswer,
}: {
  engine: AkinatorEngine | DescriptorEngine;
  onFlipAnswer?: ((attrId: string, newValue: number) => void) | undefined;
  onChangeDescriptorAnswer?: ((questionId: string, newOptionId: string) => void) | undefined;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  if (engine instanceof DescriptorEngine) {
    const items = engine.descriptorAnswers;
    if (items.length === 0) return null;
    const editingQ = editingKey
      ? engine.questions.find((q) => q.id === editingKey)
      : null;

    return (
      <div className="glass-panel mt-3.5 rounded-2xl border border-border/70 p-3 sm:p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Your Answers ({items.length}) — tap any to change
          </span>
          {editingKey && (
            <button
              type="button"
              onClick={() => setEditingKey(null)}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
          {items.map((ans, idx) => {
            const qObj = engine.questions.find((q) => q.id === ans.questionId);
            const optObj = qObj?.options.find((o) => o.id === ans.optionId);
            const isSelected = editingKey === ans.questionId;
            return (
              <button
                key={ans.questionId}
                type="button"
                onClick={() =>
                  setEditingKey(isSelected ? null : ans.questionId)
                }
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                  isSelected
                    ? "border-pulse bg-pulse/15 font-semibold text-pulse"
                    : "border-border/80 bg-background/60 text-foreground/90 hover:border-pulse/50"
                }`}
                title={`${idx + 1}. ${qObj?.question ?? ans.questionId}: ${optObj?.label ?? ans.optionId} (click to change)`}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {idx + 1}.
                </span>
                <span>{optObj?.emoji ?? "🎵"}</span>
                <span className="max-w-[160px] truncate">{optObj?.label ?? ans.optionId}</span>
              </button>
            );
          })}
        </div>

        {editingQ && onChangeDescriptorAnswer && (
          <div className="mt-3 rounded-xl border border-pulse/40 bg-background/85 p-3">
            <p className="text-xs font-semibold text-foreground">
              Change answer for: <span className="text-pulse">{editingQ.question}</span>
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {editingQ.options.slice(0, 4).map((opt) => {
                const current = items.find((a) => a.questionId === editingQ.id);
                const isCurrent = current?.optionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeDescriptorAnswer(editingQ.id, opt.id);
                      setEditingKey(null);
                    }}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition active:scale-95 ${
                      isCurrent
                        ? "border-pulse bg-pulse/15 font-bold text-pulse"
                        : "border-border/70 bg-card/60 hover:border-pulse/50"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const stdAnswers = engine.answers;
  if (stdAnswers.length === 0) return null;
  const editingAttr = editingKey
    ? ATTRIBUTES.find((a) => a.id === editingKey)
    : null;

  return (
    <div className="glass-panel mt-3.5 rounded-2xl border border-border/70 p-3 sm:p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Your Answers ({stdAnswers.length}) — tap any to change
        </span>
        {editingKey && (
          <button
            type="button"
            onClick={() => setEditingKey(null)}
            className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>
      <div className="no-scrollbar -mx-1 mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
        {stdAnswers.map((ans, idx) => {
          const attr = ATTRIBUTES.find((a) => a.id === ans.attributeId);
          const resp = RESPONSES.find((r) => r.value === ans.value);
          const isSelected = editingKey === ans.attributeId;
          return (
            <button
              key={ans.attributeId}
              type="button"
              onClick={() =>
                setEditingKey(isSelected ? null : ans.attributeId)
              }
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                isSelected
                  ? "border-pulse bg-pulse/15 font-semibold text-pulse"
                  : "border-border/80 bg-background/60 text-foreground/90 hover:border-pulse/50"
              }`}
              title={`${idx + 1}. ${attr?.question ?? ans.attributeId}: ${resp?.label ?? ans.value}`}
            >
              <span className="font-mono text-[10px] text-muted-foreground">
                {idx + 1}.
              </span>
              <span className="max-w-[140px] truncate">
                {attr?.question ?? ans.attributeId}
              </span>
              <span className="font-bold text-pulse">
                {resp?.label ?? ans.value}
              </span>
            </button>
          );
        })}
      </div>

      {editingAttr && onFlipAnswer && (
        <div className="mt-3 rounded-xl border border-pulse/40 bg-background/85 p-3">
          <p className="text-xs font-semibold text-foreground">
            Change answer for: <span className="text-pulse">{editingAttr.question}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RESPONSES.map((r) => {
              const current = stdAnswers.find(
                (a) => a.attributeId === editingAttr.id
              );
              const isCurrent = current?.value === r.value;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => {
                    onFlipAnswer(editingAttr.id, r.value);
                    setEditingKey(null);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    isCurrent
                      ? "border-pulse bg-pulse/15 text-pulse"
                      : "border-border/70 bg-card/60 hover:border-pulse/50"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveLeaderStrip({
  topCandidate,
  drillName,
  earlySelectTarget,
  onSelectGenre,
}: {
  topCandidate?: { genre: Genre; prob: number } | undefined;
  drillName?: string | null | undefined;
  earlySelectTarget?: { genre: Genre; prob: number } | null | undefined;
  onSelectGenre?: ((genreId: string) => void) | undefined;
}) {
  if (!topCandidate && !drillName) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card/60 px-3 py-2 text-xs backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {drillName && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sound/40 bg-sound/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sound">
            🔬 {drillName}
          </span>
        )}
        {topCandidate && (
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Leading:
            </span>
            <span className="truncate font-bold text-foreground">
              {topCandidate.genre.name}
            </span>
            <span className="font-mono text-[11px] font-semibold text-pulse">
              {Math.round(topCandidate.prob * 100)}%
            </span>
          </div>
        )}
      </div>

      {earlySelectTarget && onSelectGenre && (
        <Button
          size="sm"
          onClick={() => onSelectGenre(earlySelectTarget.genre.id)}
          className="h-7 shrink-0 bg-pulse px-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-pulse/90 active:scale-95"
        >
          <Check className="mr-1 size-3.5" />
          It&apos;s {earlySelectTarget.genre.name}!
        </Button>
      )}
    </div>
  );
}

const STANDARD_BTN_ORDER = [
  "order-1 md:order-1",
  "order-2 md:order-2",
  "col-span-2 md:col-span-1 order-5 md:order-3",
  "order-3 md:order-4",
  "order-4 md:order-5",
];

function QuestionView({
  engine, q, isAlternative = false, isConfirming = false, suspectName, drill, baseCount, hintOpen, setHintOpen, onRespond, onUndo, onSelectGenre, onFlipAnswer,
}: {
  engine: AkinatorEngine; q: (typeof ATTRIBUTES)[number]; isAlternative?: boolean; isConfirming?: boolean; suspectName?: string | undefined; drill: string | null; baseCount: number;
  hintOpen: boolean; setHintOpen: (b: boolean) => void; onRespond: (v: number, isAlt?: boolean) => void; onUndo: () => void;
  onSelectGenre?: (genreId: string) => void;
  onFlipAnswer?: ((attrId: string, newValue: number) => void) | undefined;
}) {
  const [rephrased, setRephrased] = useState(false);
  useEffect(() => {
    setRephrased(false);
  }, [q.id]);

  const isShowingAlternative = isAlternative || rephrased;
  const certainty = Math.round(engine.certainty() * 100);
  const cat = CAT_CLASS[q.category];
  const meta = CATEGORY_META[q.category];
  const n = engine.questionCount + 1;
  const drillName = drill ? GENRES.find((g) => g.id === drill)?.name : null;

  const isMicroMode = Boolean(drill) || engine.candidates.some((c) => c.parent !== null);
  const parentCandidates = isMicroMode
    ? []
    : engine.ranked().filter((r) => r.genre.parent === null);
  const subCandidates = isMicroMode
    ? engine.ranked()
    : engine.rankedAllSubgenres();

  const showTwoCards =
    !isMicroMode &&
    parentCandidates.length > 0 &&
    subCandidates.length > 0 &&
    subCandidates[0]!.prob >= 0.15;

  const canEarlySelectParent = checkEarlySelect(parentCandidates, engine.questionCount);
  const canEarlySelectSub = checkEarlySelect(subCandidates, engine.questionCount);

  const primaryList = isMicroMode
    ? subCandidates
    : parentCandidates.length > 0
    ? parentCandidates
    : subCandidates;
  const topLeader = engine.questionCount >= 1 ? primaryList[0] : undefined;
  const earlySelectTarget = canEarlySelectSub
    ? subCandidates[0]
    : canEarlySelectParent
    ? parentCandidates[0]
    : null;

  const gainingYes = useMemo(
    () => engine.getGainingGenres(q.id, 1.0, 6),
    [engine, q.id]
  );
  const gainingNo = useMemo(
    () => engine.getGainingGenres(q.id, -1.0, 6),
    [engine, q.id]
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-3 sm:mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!engine.canUndo && !drill}
          className="h-8 px-2.5 text-xs active:scale-95"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>CERTAINTY</span>
            <span>{certainty}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-pulse to-voice transition-all duration-500"
              style={{ width: `${certainty}%` }}
            />
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs">
          Q{n}
        </span>
      </div>

      <LiveLeaderStrip
        topCandidate={topLeader}
        drillName={drillName}
        earlySelectTarget={earlySelectTarget}
        onSelectGenre={onSelectGenre}
      />

      {/* Question Card First — Above the Fold, Zero Layout Shift */}
      <div className={`glass-panel animate-slide-in rounded-3xl border ${cat.border} p-4 sm:p-6 md:p-9`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full ${cat.bg} ${cat.text} px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest sm:text-xs`}>
            {meta.emoji} {meta.label}
          </span>
          {q.alternativePrompt && (
            isShowingAlternative ? (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold text-pulse">🔄 Rephrased</span>
                {!isAlternative && (
                  <button
                    type="button"
                    onClick={() => setRephrased(false)}
                    className="font-mono text-xs text-muted-foreground underline hover:text-foreground active:scale-95"
                  >
                    (Original)
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRephrased(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition hover:border-pulse/50 hover:text-foreground active:scale-95 sm:text-xs"
              >
                <HelpCircle className="size-3.5 text-muted-foreground" />
                <span>Rephrase</span>
              </button>
            )
          )}
        </div>
        {isAlternative && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-pulse/40 bg-pulse/10 px-3 py-2 text-xs font-semibold text-pulse">
            <span>🔄</span>
            <span>You were unsure earlier — here is another angle on this sound:</span>
          </div>
        )}
        {isConfirming && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500">
            <span>🎯</span>
            <span>Zeroing in: Confirming signature {suspectName ? `"${suspectName}"` : "genre"} sound</span>
          </div>
        )}
        <h2 className="mt-4 text-balance text-xl font-extrabold leading-snug sm:mt-5 sm:text-2xl md:text-3xl">
          {isShowingAlternative ? q.alternativePrompt : q.question}
        </h2>
        {hintOpen ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/50 p-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>🎧 Clues & Context</span>
              </span>
              <button
                type="button"
                onClick={() => setHintOpen(false)}
                className="font-mono text-[11px] text-muted-foreground transition hover:text-foreground active:scale-95"
              >
                Hide
              </button>
            </div>
            <div className="mt-2.5 space-y-2">
              {q.hint && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded-md bg-pulse/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-pulse">
                    💡 Hint
                  </span>
                  <span className="text-pretty leading-relaxed text-foreground/90">{q.hint}</span>
                </div>
              )}
              {q.polarOpposite && (
                <div className="flex items-start gap-2 border-t border-border/40 pt-2">
                  <span className="shrink-0 rounded-md bg-voice/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-voice">
                    ⚖️ Opposite
                  </span>
                  <span className="text-pretty leading-relaxed text-muted-foreground">{q.polarOpposite}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setHintOpen(true)}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1 font-mono text-xs text-muted-foreground transition hover:border-border hover:text-foreground active:scale-95"
          >
            <ChevronDown className="size-3.5" />
            <span>Show hint & opposite</span>
          </button>
        )}

        {/* Thumb-friendly 2-column grid on mobile, 5-column spectrum on desktop */}
        <div className="mt-6 grid grid-cols-2 gap-2 md:mt-7 md:grid-cols-5">
          {RESPONSES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => onRespond(r.value, isShowingAlternative)}
              className={`flex min-h-[50px] items-center justify-center rounded-xl border p-3 text-center text-sm font-bold transition-transform duration-100 active:scale-95 md:min-h-[56px] md:text-base ${RESP_CLASS[i]} ${STANDARD_BTN_ORDER[i]}`}
            >
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        {(gainingYes.length > 0 || gainingNo.length > 0) && (
          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-5">
            <div className="flex flex-col justify-between rounded-2xl border border-pulse/30 bg-pulse/[0.04] p-3 text-left md:col-span-2">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-pulse">
                  <span className="size-2 rounded-full bg-pulse shadow-[0_0_8px_var(--pulse)]" />
                  <span>Boosts if Yes / Probably</span>
                </div>
                {gainingYes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {gainingYes.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-full border border-pulse/35 bg-pulse/10 px-2 py-0.5 font-sans text-[11px] font-medium text-pulse"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground/60 italic">No genres strongly boosted</p>
                )}
              </div>
            </div>

            <div className="hidden md:col-span-1 md:flex md:items-center md:justify-center">
              <span className="font-mono text-xs text-muted-foreground/30">───</span>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-3 text-left md:col-span-2">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-destructive">
                  <span className="size-2 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)]" />
                  <span>Boosts if No / Probably Not</span>
                </div>
                {gainingNo.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {gainingNo.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-full border border-destructive/35 bg-destructive/10 px-2 py-0.5 font-sans text-[11px] font-medium text-destructive"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground/60 italic">No genres strongly boosted</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Candidate Probability Bars Below Question — Zero Layout Shift */}
      <div className="mt-4">
        {showTwoCards ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <CandidateCard
              title="Parent genres"
              candidates={parentCandidates}
              canEarlySelect={canEarlySelectParent}
              onSelectGenre={onSelectGenre}
            />
            <CandidateCard
              title="Sub-genres"
              candidates={subCandidates}
              canEarlySelect={canEarlySelectSub}
              onSelectGenre={onSelectGenre}
              showParentTag={true}
            />
          </div>
        ) : (
          <CandidateCard
            title={isMicroMode ? "Candidate sub-genres" : "Top candidates"}
            candidates={primaryList}
            canEarlySelect={isMicroMode ? canEarlySelectSub : canEarlySelectParent}
            onSelectGenre={onSelectGenre}
            showParentTag={isMicroMode}
          />
        )}
      </div>

      <AnswerTrail engine={engine} onFlipAnswer={onFlipAnswer} />
    </section>
  );
}

function DescriptorQuestionView({
  engine,
  q,
  drill,
  onRespond,
  onUndo,
  onSelectGenre,
  onChangeDescriptorAnswer,
}: {
  engine: DescriptorEngine;
  q: DescriptorQuestion;
  drill?: string | null;
  onRespond: (optionId: string) => void;
  onUndo: () => void;
  onSelectGenre?: ((genreId: string) => void) | undefined;
  onChangeDescriptorAnswer?: ((questionId: string, newOptionId: string) => void) | undefined;
}) {
  const certainty = Math.round(engine.certainty() * 100);
  const cat = CAT_CLASS[q.category] ?? CAT_CLASS.sound;
  const meta = CATEGORY_META[q.category] ?? CATEGORY_META.sound;
  const n = engine.questionCount + 1;
  const drillName = drill ? GENRES.find((g) => g.id === drill)?.name : null;

  const isMicroMode = Boolean(drill);
  const parentCandidates = engine.ranked().filter((r) => r.genre.parent === null);
  const subCandidates = isMicroMode ? engine.ranked() : engine.rankedAllSubgenres();

  const showTwoCards =
    !isMicroMode &&
    parentCandidates.length > 0 &&
    subCandidates.length > 0 &&
    subCandidates[0]!.prob >= 0.15;

  const canEarlySelectParent = checkEarlySelect(parentCandidates, engine.questionCount);
  const canEarlySelectSub = checkEarlySelect(subCandidates, engine.questionCount);

  const primaryList = isMicroMode
    ? subCandidates
    : parentCandidates.length > 0
    ? parentCandidates
    : subCandidates;
  const topLeader = engine.questionCount >= 1 ? primaryList[0] : undefined;
  const earlySelectTarget = canEarlySelectSub
    ? subCandidates[0]
    : canEarlySelectParent
    ? parentCandidates[0]
    : null;

  const visibleOptions = useMemo(() => q.options.slice(0, 4), [q.options]);

  const gainingMap = useMemo(
    () => visibleOptions.map((opt) => engine.getGainingGenres(opt, 3)),
    [engine, visibleOptions]
  );

  return (
    <section>
      <div className="mb-3 flex items-center gap-3 sm:mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!engine.canUndo && !drill}
          className="h-8 px-2.5 text-xs active:scale-95"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>CERTAINTY</span>
            <span>{certainty}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-pulse to-voice transition-all duration-500"
              style={{ width: `${certainty}%` }}
            />
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs">
          {n <= 8 ? `Q${n} / ~8` : `Q${n}`}
        </span>
      </div>

      <LiveLeaderStrip
        topCandidate={topLeader}
        drillName={drillName}
        earlySelectTarget={earlySelectTarget}
        onSelectGenre={onSelectGenre}
      />

      {/* Question & Options First — Above the Fold, Zero Vertical Shift */}
      <div className={`glass-panel animate-slide-in rounded-3xl border ${cat.border} p-4 sm:p-6 md:p-9`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full ${cat.bg} ${cat.text} px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest sm:text-xs`}>
            {meta.emoji} {meta.label}
          </span>
          <span className="rounded-full bg-pulse/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-pulse sm:text-[11px]">
            🎧 Pick closest match
          </span>
        </div>

        <h2 className="mt-3.5 text-balance text-xl font-extrabold leading-snug sm:mt-5 sm:text-2xl md:text-3xl">
          {q.question}
        </h2>
        {q.subtitle && (
          <p className="mt-1.5 text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {q.subtitle}
          </p>
        )}

        {q.hint && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
            <span className="shrink-0 rounded-md bg-pulse/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-pulse">
              💡 Tip
            </span>
            <span className="text-pretty leading-relaxed text-foreground/85">{q.hint}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:mt-7 sm:grid-cols-2 sm:gap-3">
          {visibleOptions.map((opt, i) => {
            const isFallbackOption = i === 3 || Object.keys(opt.effects).length === 0;
            return (
              <button
                key={opt.id}
                onClick={() => onRespond(opt.id)}
                className={
                  isFallbackOption
                    ? "group relative flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-3.5 text-left transition hover:border-muted-foreground/60 hover:bg-muted/35 active:scale-[0.985] sm:flex-col sm:items-start sm:justify-between sm:p-5"
                    : "group relative flex items-start gap-3.5 rounded-2xl border border-border/85 bg-card/75 p-3.5 text-left shadow-sm transition hover:border-pulse hover:bg-card hover:shadow-[0_0_25px_-6px_var(--pulse)] active:scale-[0.985] sm:flex-col sm:gap-0 sm:p-5"
                }
              >
                <div
                  className={
                    isFallbackOption
                      ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-xl transition group-hover:scale-105 sm:size-11 sm:text-2xl"
                      : "flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-2xl transition group-hover:scale-105 group-hover:border-pulse/40"
                  }
                >
                  <span>{opt.emoji}</span>
                </div>
                <div className="min-w-0 flex-1 sm:mt-3 sm:w-full">
                  <h3
                    className={
                      isFallbackOption
                        ? "text-sm font-semibold text-foreground/85 transition-colors group-hover:text-foreground sm:text-base"
                        : "text-sm font-bold text-foreground transition-colors group-hover:text-pulse sm:text-base"
                    }
                  >
                    {opt.label}
                  </h3>
                  <p className="mt-0.5 text-pretty text-xs leading-relaxed text-muted-foreground sm:mt-1">
                    {opt.description}
                  </p>
                  {!isFallbackOption && gainingMap[i] && gainingMap[i].length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-border/40 pt-2 w-full sm:mt-3.5 sm:gap-1.5 sm:pt-2.5">
                      {gainingMap[i].map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center rounded-full border border-border/80 bg-background/40 px-2 py-0.5 font-sans text-[10px] text-muted-foreground transition group-hover:border-pulse/50 group-hover:text-foreground"
                          title={`Boosts confidence for ${name}`}
                        >
                          <span>{name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Candidate Probability Bars Below Question — Zero Layout Shift */}
      <div className="mt-4">
        {showTwoCards ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <CandidateCard
              title="Parent genres"
              candidates={parentCandidates}
              canEarlySelect={canEarlySelectParent}
              onSelectGenre={onSelectGenre}
            />
            <CandidateCard
              title="Sub-genres"
              candidates={subCandidates}
              canEarlySelect={canEarlySelectSub}
              onSelectGenre={onSelectGenre}
              showParentTag={true}
            />
          </div>
        ) : (
          <CandidateCard
            title={isMicroMode ? `Subgenres of ${drillName ?? "Family"}` : "Top candidates"}
            candidates={primaryList}
            canEarlySelect={isMicroMode ? canEarlySelectSub : canEarlySelectParent}
            onSelectGenre={onSelectGenre}
            showParentTag={isMicroMode}
          />
        )}
      </div>

      <AnswerTrail engine={engine} onChangeDescriptorAnswer={onChangeDescriptorAnswer} />
    </section>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative size-32 shrink-0 sm:size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--pulse)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold sm:text-3xl">{Math.round(value * 100)}%</span>
        <span className="text-[11px] text-muted-foreground sm:text-xs">match</span>
      </div>
    </div>
  );
}

function Diagnosis({
  engine, drill, onDrill, onExitDrill, onAgain, onUndo, onWrong, onFlipAnswer, onChangeDescriptorAnswer, onCopyDevSnapshot, isLocalDev,
}: {
  engine: AkinatorEngine | DescriptorEngine; drill: string | null; onDrill: (id: string) => void; onExitDrill?: () => void; onAgain: () => void; onUndo: () => void; onWrong: () => void;
  onFlipAnswer: (attrId: string, newValue: number) => void;
  onChangeDescriptorAnswer?: (questionId: string, newOptionId: string) => void;
  onCopyDevSnapshot?: () => void;
  isLocalDev?: boolean;
}) {
  const ranked = engine.ranked();
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const activeEntry = useMemo(
    () => (selectedGenreId ? ranked.find((r) => r.genre.id === selectedGenreId) ?? ranked[0]! : ranked[0]!),
    [ranked, selectedGenreId]
  );
  const g = activeEntry.genre;
  const tension = useMemo(() => engine.computeTension(g), [engine, g]);
  const drillGenreName = drill ? GENRES.find((x) => x.id === drill)?.name ?? drill : null;

  useEffect(() => {
    setSelectedGenreId(null);
  }, [ranked[0]?.genre.id]);

  useEffect(() => {
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.4 }, colors: ["#10b981", "#8b5cf6", "#06b6d4", "#f59e0b"] });
  }, [ranked[0]?.genre.id]);

  const hallmarks = useMemo(() => {
    if (!g.sensoryHallmarks) return [];
    const categories: Category[] = ["pulse", "sound", "atmosphere", "voice"];
    return categories
      .filter((cat) => Boolean(g.sensoryHallmarks[cat]))
      .map((cat) => [cat, g.sensoryHallmarks[cat]] as [Category, string]);
  }, [g]);

  const allSubgenres = useMemo(() => engine.rankedAllSubgenres(), [engine]);
  const topCrossSubgenre = allSubgenres[0];
  const crossSubgenreParent = topCrossSubgenre?.genre.parent
    ? GENRES.find((x) => x.id === topCrossSubgenre.genre.parent)
    : null;

  const tracks = g.benchmarkTracks?.length ? g.benchmarkTracks : [g.benchmark];
  const canDrill = !drill && hasSubgenres(g.id);

  return (
    <section className="animate-slide-in space-y-4 sm:space-y-5">
      {/* Hero Result Card */}
      <div className="glass-panel rounded-3xl border border-pulse/40 p-5 sm:p-7 md:p-10">
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:text-xs">
            {selectedGenreId && selectedGenreId !== ranked[0]?.genre.id
              ? `Inspecting runner-up • Top match: ${ranked[0]?.genre.name}`
              : `Diagnosis complete • ${engine.questionCount} questions`}
          </p>
          {selectedGenreId && selectedGenreId !== ranked[0]?.genre.id && (
            <button
              type="button"
              onClick={() => setSelectedGenreId(null)}
              className="rounded-full border border-pulse/40 bg-pulse/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-pulse hover:bg-pulse/20"
            >
              ↩ Back to #1 ({ranked[0]?.genre.name})
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:gap-7 md:text-left">
          <Gauge value={activeEntry.prob} />
          <div className="min-w-0 flex-1">
            {g.parent && (
              <p className="font-mono text-xs uppercase tracking-widest text-sound">
                Subgenre of {GENRES.find((x) => x.id === g.parent)?.name ?? g.parent}
              </p>
            )}
            <h2 className="mt-0.5 bg-gradient-to-r from-pulse via-voice to-sound bg-clip-text text-balance text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl">
              {g.name}
            </h2>
            {g.aliases && g.aliases.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 md:justify-start">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Also known as:
                </span>
                {g.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="rounded-full border border-border/80 bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
              {g.summary}
            </p>
          </div>
        </div>

        {hallmarks.length > 0 && (
          <ul className="mt-6 grid gap-2.5 text-left sm:grid-cols-2">
            {hallmarks.map(([cat, text]) => (
              <li key={cat} className={`rounded-2xl border ${CAT_CLASS[cat].border} ${CAT_CLASS[cat].bg} p-3.5 text-xs sm:text-sm`}>
                <span className={`font-mono text-[11px] font-bold uppercase ${CAT_CLASS[cat].text}`}>
                  {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                </span>
                <p className="mt-1 text-pretty leading-relaxed text-foreground/95">{text}</p>
              </li>
            ))}
          </ul>
        )}

        {g.distinctionNotes && (
          <div className="mt-4 rounded-2xl border border-sound/30 bg-sound/5 p-3.5 text-left text-xs leading-relaxed text-muted-foreground">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-sound">
              🧭 How to Tell It Apart:{" "}
            </span>
            <span className="text-pretty text-foreground/90">{g.distinctionNotes}</span>
          </div>
        )}
      </div>

      {/* Primary Next-Step Action Strip — Immediately Accessible Above the Fold on Mobile */}
      <div className="flex flex-wrap items-center gap-2">
        {canDrill && (
          <Button
            onClick={() => onDrill(g.id)}
            className="h-10 flex-1 bg-sound font-bold text-foreground shadow-sm hover:bg-sound/85 active:scale-95 sm:flex-none"
          >
            <Microscope className="size-4" /> Pinpoint Exact Subgenre
          </Button>
        )}
        {drill && onExitDrill && (
          <Button
            variant="outline"
            onClick={onExitDrill}
            className="h-10 border-sound/50 text-sound hover:bg-sound/15 active:scale-95"
          >
            <ChevronLeft className="size-4" /> Back to All Genres
          </Button>
        )}
        <Button
          variant={canDrill ? "secondary" : "default"}
          onClick={onAgain}
          className="h-10 flex-1 font-bold active:scale-95 sm:flex-none"
        >
          <RotateCcw className="size-4" /> Play Again
        </Button>
        <Button variant="outline" onClick={onUndo} className="h-10 active:scale-95">
          <ChevronLeft className="size-4" /> Change Last Answer
        </Button>
        <Button variant="outline" onClick={onWrong} className="h-10 active:scale-95">
          <X className="size-4" /> Wrong Genre?
        </Button>
        {isLocalDev && onCopyDevSnapshot && (
          <Button
            variant="outline"
            onClick={onCopyDevSnapshot}
            className="h-10 border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 active:scale-95"
          >
            <Bug className="mr-1.5 size-4" /> Dev Copy State
          </Button>
        )}
      </div>

      {topCrossSubgenre && (!drill || topCrossSubgenre.genre.parent !== drill) && topCrossSubgenre.prob >= 0.25 && (
        <div className="rounded-3xl border border-sound/40 bg-sound/10 p-4 text-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-semibold text-sound">
                <span>🎯</span> Top Subgenre Match: {topCrossSubgenre.genre.name}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Across all subgenres, this track strongly matches{" "}
                <span className="font-bold text-foreground">{topCrossSubgenre.genre.name}</span>
                {crossSubgenreParent ? (
                  <> (a subgenre of <span className="font-semibold text-foreground">{crossSubgenreParent.name}</span>)</>
                ) : null}
                {" "}with a <span className="font-mono font-bold text-foreground">{Math.round(topCrossSubgenre.prob * 100)}%</span> match.
              </p>
            </div>
            {topCrossSubgenre.genre.parent && topCrossSubgenre.genre.parent !== drill && (
              <Button
                size="sm"
                onClick={() => onDrill(topCrossSubgenre.genre.parent!)}
                className="shrink-0 bg-sound text-foreground hover:bg-sound/80 active:scale-95"
              >
                <Microscope className="mr-1.5 size-4" />
                Explore {crossSubgenreParent?.name ?? "Family"}
              </Button>
            )}
          </div>
        </div>
      )}

      {tension.outlier && (
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-semibold text-amber-500">
                <span>⚠️</span> Unusual answer noticed
              </p>
              {"descriptorQuestionId" in tension.outlier && tension.outlier.descriptorQuestionId ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  You selected{" "}
                  <span className="font-bold text-foreground">
                    &ldquo;{tension.outlier.chosenOptionLabel}&rdquo;
                  </span>{" "}
                  for{" "}
                  <span className="font-medium italic text-foreground">
                    &ldquo;{tension.outlier.descriptorQuestionText}&rdquo;
                  </span>
                  , which conflicts with typical <span className="font-semibold text-foreground">{g.name}</span> tracks.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  You answered{" "}
                  <span className="font-bold text-foreground">
                    &ldquo;{RESPONSES.find((r) => r.value === tension.outlier!.actual)?.label ?? tension.outlier.actual}&rdquo;
                  </span>{" "}
                  for{" "}
                  <span className="font-medium italic text-foreground">
                    &ldquo;{tension.outlier.attribute.question}&rdquo;
                  </span>
                  . If this track was actually {tension.outlier.expected > 0 ? "YES" : "NO"}, tap to recalculate:
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {"descriptorQuestionId" in tension.outlier &&
              tension.outlier.descriptorQuestionId &&
              tension.outlier.suggestedOptionId &&
              onChangeDescriptorAnswer ? (
                (() => {
                  const qId = tension.outlier.descriptorQuestionId;
                  const sId = tension.outlier.suggestedOptionId;
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onChangeDescriptorAnswer(qId, sId)}
                      className="border-amber-500/40 text-amber-500 hover:bg-amber-500/20 active:scale-95"
                    >
                      🔄 Switch to &ldquo;{tension.outlier.suggestedOptionLabel}&rdquo;
                    </Button>
                  );
                })()
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onFlipAnswer(
                      tension.outlier!.attributeId,
                      tension.outlier!.expected > 0 ? 1 : -1
                    )
                  }
                  className="border-amber-500/40 text-amber-500 hover:bg-amber-500/20 active:scale-95"
                >
                  🔄 Recalculate with {tension.outlier.expected > 0 ? "Yes" : "No"}
                </Button>
              )}
              {drill && onExitDrill && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onExitDrill}
                  className="border-sound/40 text-sound hover:bg-sound/20 active:scale-95"
                >
                  ↩️ Exit {drillGenreName}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Studio Tracklist Card */}
      <div className="glass-panel rounded-3xl border border-border/80 p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          🎧 Benchmark {tracks.length > 1 ? `Tracks (${tracks.length})` : "Track"}
        </p>
        <div className="mt-3 space-y-2">
          {tracks.map((t, idx) => {
            const qStr = encodeURIComponent(`${t.artist} ${t.title}`);
            return (
              <div
                key={`${t.artist}-${t.title}-${idx}`}
                className="flex flex-col justify-between gap-2.5 rounded-2xl border border-border/70 bg-background/50 p-3 sm:flex-row sm:items-center sm:p-3.5"
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-pulse shrink-0">
                    0{idx + 1}
                  </span>
                  <div className="truncate text-sm">
                    <span className="font-bold text-foreground">{t.artist}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span className="italic text-foreground/90">{t.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" asChild>
                    <a href={`https://open.spotify.com/search/${qStr}`} target="_blank" rel="noreferrer">
                      <Music2 className="size-3.5" /> Spotify
                    </a>
                  </Button>
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" asChild>
                    <a href={`https://music.apple.com/search?term=${qStr}`} target="_blank" rel="noreferrer">
                      <Music2 className="size-3.5" /> Apple
                    </a>
                  </Button>
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" asChild>
                    <a href={`https://www.youtube.com/results?search_query=${qStr}`} target="_blank" rel="noreferrer">
                      <Youtube className="size-3.5" /> YouTube
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Runner-ups Comparison Card */}
      <div className="glass-panel rounded-3xl border border-border/80 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {drill ? "Subgenre Runner-ups" : "Runner-ups"}
          </p>
          <span className="font-mono text-[10px] text-muted-foreground">
            Tap any row to compare
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {ranked.slice(1, 4).map((r) => {
            const isSelected = selectedGenreId === r.genre.id;
            return (
              <button
                key={r.genre.id}
                type="button"
                onClick={() =>
                  setSelectedGenreId(isSelected ? null : r.genre.id)
                }
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs transition active:scale-[0.99] sm:text-sm ${
                  isSelected
                    ? "border-pulse bg-pulse/10 shadow-sm"
                    : "border-border/50 bg-background/35 hover:border-border hover:bg-background/60"
                }`}
              >
                <span className="w-32 truncate font-semibold text-foreground sm:w-44">
                  {r.genre.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-sound transition-all duration-500" style={{ width: `${r.prob * 100}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-xs">{(r.prob * 100).toFixed(1)}%</span>
                <span
                  className={`hidden rounded-full px-2 py-0.5 font-mono text-[10px] sm:inline-block ${
                    isSelected
                      ? "bg-pulse text-background font-bold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isSelected ? "Viewing" : "Compare"}
                </span>
              </button>
            );
          })}
        </div>

        {!drill && allSubgenres.length > 0 && (allSubgenres[0]?.prob ?? 0) >= 0.08 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Leading Subgenres Across All Families
            </p>
            <div className="space-y-2">
              {allSubgenres.slice(0, 3).map((r) => {
                const parentG = GENRES.find((x) => x.id === r.genre.parent);
                return (
                  <div key={r.genre.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium text-foreground">{r.genre.name}</span>
                      {parentG && (
                        <button
                          type="button"
                          onClick={() => onDrill(parentG.id)}
                          className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground transition hover:bg-sound/20 hover:text-sound"
                          title={`Explore ${parentG.name} subgenres`}
                        >
                          {parentG.name} ↗
                        </button>
                      )}
                    </div>
                    <span className="font-mono font-bold text-muted-foreground">
                      {(r.prob * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AnswerTrail
        engine={engine}
        onFlipAnswer={onFlipAnswer}
        onChangeDescriptorAnswer={onChangeDescriptorAnswer}
      />
    </section>
  );
}

function FeedbackModal({ open, onOpenChange, engine }: { open: boolean; onOpenChange: (b: boolean) => void; engine: AkinatorEngine | DescriptorEngine }) {
  const [search, setSearch] = useState("");
  const [actual, setActual] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const list = GENRES.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  const submit = () => {
    const predictedGenre = engine.ranked()[0]?.genre;
    const actualName = actual ? GENRES.find((g) => g.id === actual)?.name ?? actual : search.trim();
    const sessionId = crypto.randomUUID();
    const isDescriptor = engine instanceof DescriptorEngine;

    const trace = {
      sessionId,
      createdAt: new Date().toISOString(),
      mode: isDescriptor ? "descriptor" : "standard",
      answers: isDescriptor ? engine.descriptorAnswers : engine.answers,
      predicted: predictedGenre?.id,
      actual: actual ?? search.trim(),
      audioUrl: audioUrl.trim() || undefined,
      note: note.trim() || undefined,
    };

    // Store in localStorage as local backup
    const key = "genre-genie-feedback";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
    localStorage.setItem(key, JSON.stringify([...prev, trace]));

    // Build markdown issue body
    const title = `[Correction] Predicted: ${predictedGenre?.name ?? "Unknown"} vs Actual: ${actualName}`;

    const maxUrlAnswers = 35;
    let answerRows = "";
    let totalCount = 0;

    if (isDescriptor) {
      totalCount = engine.descriptorAnswers.length;
      answerRows = engine.descriptorAnswers
        .slice(0, maxUrlAnswers)
        .map((a, i) => {
          const qObj = engine.questions.find((q) => q.id === a.questionId);
          const optObj = qObj?.options.find((o) => o.id === a.optionId);
          return `| ${i + 1} | \`${a.questionId}\` | **${optObj?.label ?? a.optionId}** (${optObj?.emoji ?? ""}) |`;
        })
        .join("\n");
    } else {
      totalCount = engine.answers.length;
      answerRows = engine.answers
        .slice(0, maxUrlAnswers)
        .map((a, i) => {
          const resp = RESPONSES.find((r) => r.value === a.value)?.label ?? String(a.value);
          return `| ${i + 1} | \`${a.attributeId}\` | **${resp}** |`;
        })
        .join("\n");
    }

    const overflowNote = totalCount > maxUrlAnswers
      ? `\n\n*... and ${totalCount - maxUrlAnswers} more questions (full list copied to clipboard).*`
      : "";

    // Safely trim note if extraordinarily long to prevent URL length overflow
    const safeNote = note.trim().length > 600 ? `${note.trim().slice(0, 600)}… *(truncated)*` : note.trim();

    const body = `### 🎵 Genre Correction Report

- **Predicted Genre**: ${predictedGenre ? `${predictedGenre.name} (${(engine.ranked()[0]!.prob * 100).toFixed(1)}%)` : "None"}
- **Actual Genre**: **${actualName}**
- **Engine Mode**: \`${isDescriptor ? "descriptor" : "standard"}\`
- **Audio Sample**: ${audioUrl.trim() ? audioUrl.trim() : "*None provided*"}

---

### 📝 Listener Notes
${safeNote ? `> ${safeNote.replace(/\n/g, "\n> ")}` : "*No extra notes provided.*"}

---

### 🔍 Session Diagnostic Trace (${totalCount} questions)
<details open>
<summary>View question responses</summary>

| # | Question / Attribute | Listener Response |
|---|---|---|
${answerRows}
</details>${overflowNote}

---
*Reported from [Genre Genie](https://sonotaxo.github.io/genre-genie/)*
`;

    const fullTraceString = JSON.stringify(trace, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullTraceString).catch(() => {});
    }

    const issueUrl = `https://github.com/Sonotaxo/genre-genie/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent("calibration,feedback")}`;

    window.open(issueUrl, "_blank", "noopener,noreferrer");
    toast.success("Opening GitHub issue! Full diagnostic trace copied to clipboard.");
    onOpenChange(false);
    setSearch("");
    setActual(null);
    setAudioUrl("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>What was the real genre?</DialogTitle>
          <DialogDescription>
            Help calibrate Genre Genie by opening a GitHub issue with your song and perceptual trace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Real Genre <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Search or enter genre (e.g. Psy-Trance, Tech House)…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActual(null); }}
            />
          </div>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {list.slice(0, 15).map((g) => (
              <button
                key={g.id}
                onClick={() => { setActual(g.id); setSearch(g.name); }}
                className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                  actual === g.id ? "border-primary bg-primary/20 font-bold text-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Audio Sample (optional)
            </label>
            <Input
              placeholder="Link to YouTube, Spotify, SoundCloud, or Bandcamp…"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              What sound gave it away? (optional)
            </label>
            <Textarea
              placeholder="e.g. Rolling bassline, squelchy 303 filter, acoustic upright bass, 808 sub…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={submit} disabled={!search.trim()} className="h-11 w-full gap-2 font-bold">
            <ExternalLink className="size-4" /> Open GitHub Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



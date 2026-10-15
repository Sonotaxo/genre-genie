import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ChevronLeft, RotateCcw, Microscope, X, ChevronDown, Music2, Youtube, ExternalLink } from "lucide-react";
import { AkinatorEngine, RESPONSES, hasSubgenres, type Answer } from "@/engine/engine";
import { ATTRIBUTES, CATEGORY_META, FAMILIES, GENRES, type Category, type Family } from "@/engine/data";
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
  const engineRef = useRef<AkinatorEngine | null>(null);
  const macroRef = useRef<AkinatorEngine | null>(null);
  const autoDrillRef = useRef(false);
  const [screen, setScreen] = useState<Screen>("IDLE");
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [drill, setDrill] = useState<string | null>(null);
  const [macroAnswers, setMacroAnswers] = useState<Answer[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const engine = engineRef.current;
  const question = screen === "PLAYING" && engine ? engine.nextQuestion() : null;

  const start = (family?: Family) => {
    engineRef.current = new AkinatorEngine(family ? { family } : {});
    setDrill(null);
    setMacroAnswers([]);
    setScreen("PLAYING");
    force();
  };

  const flipAnswer = useCallback((attrId: string, newValue: number) => {
    const e = engineRef.current;
    if (!e) return;
    const ans = e.answers.find((a) => a.attributeId === attrId);
    if (ans) {
      ans.value = newValue;
      e.updateProbabilities();
      force();
    }
  }, []);

  const makeDrill = (parent: string, prior: Answer[]) => {
    const e = new AkinatorEngine({ parent, priorAnswers: prior });
    // mark prior answers as asked so we don't repeat them
    e.answers = prior.map((a) => ({ ...a }));
    return e;
  };

  const respond = useCallback((value: number, isAlt?: boolean) => {
    const e = engineRef.current;
    const q = e?.nextQuestion();
    if (!e || !q) return;
    e.answer(q.attribute.id, value, isAlt ?? q.isAlternative ?? false);
    setHintOpen(false);
    if (e.isConverged(drill ? 8 + macroAnswers.length : 25)) {
      const top = e.ranked()[0]!.genre;
      if (!drill && hasSubgenres(top.id)) {
        const prior = [...e.answers];
        const d = makeDrill(top.id, prior);
        if (d.isClear()) {
          // subgenre already obvious from the answers: show it directly
          setMacroAnswers(prior);
          macroRef.current = e;
          autoDrillRef.current = true;
          engineRef.current = d;
          setDrill(top.id);
        }
      }
      setScreen("CONVERGED");
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
    const prior = [...(engineRef.current?.answers ?? [])];
    setMacroAnswers(prior);
    macroRef.current = engineRef.current;
    autoDrillRef.current = false;
    engineRef.current = makeDrill(parent, prior);
    setDrill(parent);
    setScreen(engineRef.current.isConverged(8 + prior.length) ? "CONVERGED" : "PLAYING");
    force();
  };

  useEffect(() => {
    if (screen !== "PLAYING") return;
    const onKey = (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= 5) respond(RESPONSES[n - 1]!.value, question?.isAlternative ?? false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, respond, question]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-14">
      <header className="mb-8 flex items-center justify-between">
        <button onClick={() => setScreen("IDLE")} className="flex items-center gap-2 font-extrabold tracking-tight">
          <Wave className="text-pulse" /> Genre Genie
        </button>
        <span className="font-mono text-xs text-muted-foreground">v1.0 • ENGINE ONLINE</span>
      </header>

      {screen === "IDLE" && <Landing onStart={start} />}
      {screen === "PLAYING" && engine && question && (
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
          setHintOpen={setHintOpen}
          onRespond={respond}
          onUndo={undo}
        />
      )}
      {screen === "CONVERGED" && engine && (
        <Diagnosis
          engine={engine}
          drill={drill}
          onDrill={startDrill}
          onAgain={() => setScreen("IDLE")}
          onUndo={undo}
          onWrong={() => setFeedbackOpen(true)}
          onFlipAnswer={flipAnswer}
        />
      )}
      {engine && (
        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} engine={engine} />
      )}
    </main>
  );
}

export const AudioAkinator = GenreGenie;

function Landing({ onStart }: { onStart: (f?: Family) => void }) {
  // Buttons only work once the page's scripts have loaded; until then show a loading state
  // instead of silently ignoring clicks.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <section className="animate-slide-in text-center">
      <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
        Think of a song or listen to the music playing.{" "}
        <span className="bg-gradient-to-r from-pulse via-voice to-sound bg-clip-text text-transparent">
          Genre Genie will guess its genre.
        </span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
        No music theory needed. Just answer simple questions about what you hear and feel.
      </p>
      <Button
        size="lg"
        onClick={() => onStart()}
        disabled={!ready}
        className="mt-10 h-16 rounded-2xl px-10 text-lg font-extrabold shadow-[0_0_40px_-6px_var(--pulse)] transition-transform duration-100 active:scale-95"
      >
        <Wave /> {ready ? "Start Guessing" : "Loading…"}
      </Button>
      <div className="mt-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">or fast-track a family</p>
        <div className="flex flex-wrap justify-center gap-2">
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => onStart(f.id)}
              disabled={!ready}
              className="rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:border-primary active:scale-95 disabled:opacity-50"
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-16 font-mono text-xs text-muted-foreground">
        {GENRES.length} Genres Cataloged • {ATTRIBUTES.length} Sensory Attributes • 100% In-Browser Engine
      </p>
    </section>
  );
}

function QuestionView({
  engine, q, isAlternative = false, isConfirming = false, suspectName, drill, baseCount, hintOpen, setHintOpen, onRespond, onUndo,
}: {
  engine: AkinatorEngine; q: (typeof ATTRIBUTES)[number]; isAlternative?: boolean; isConfirming?: boolean; suspectName?: string; drill: string | null; baseCount: number;
  hintOpen: boolean; setHintOpen: (b: boolean) => void; onRespond: (v: number, isAlt?: boolean) => void; onUndo: () => void;
}) {
  const [showAlt, setShowAlt] = useState(isAlternative);
  useEffect(() => setShowAlt(isAlternative), [q.id, isAlternative]);

  const certainty = Math.round(engine.certainty() * 100);
  const cat = CAT_CLASS[q.category];
  const meta = CATEGORY_META[q.category];
  const n = engine.questionCount - (drill ? baseCount : 0) + 1;
  const drillName = drill ? GENRES.find((g) => g.id === drill)?.name : null;
  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!engine.canUndo && !drill} className="active:scale-95">
          <ChevronLeft /> Previous
        </Button>
        <div className="flex-1">
          <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
            <span>CERTAINTY</span><span>{certainty}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-r from-pulse to-voice transition-all duration-500" style={{ width: `${certainty}%` }} />
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs">
          Q{n} of ~{drill ? 5 : 12}
        </span>
      </div>
      <div className="mb-4 rounded-2xl border border-border bg-card/60 p-4">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">Top candidates</p>
        <div className="space-y-1.5">
          {engine.ranked().slice(0, 3).map((r) => (
            <div key={r.genre.id} className="flex items-center gap-3 text-sm">
              <span className="w-32 truncate font-semibold">{r.genre.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-pulse to-voice transition-all duration-500" style={{ width: `${r.prob * 100}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-xs">{(r.prob * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      {drillName && (
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-sound">🔬 Pinpointing {drillName} subgenre</p>
      )}
      <div className={`animate-slide-in rounded-3xl border ${cat.border} bg-card/80 p-6 backdrop-blur md:p-10`}>
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-2 rounded-full ${cat.bg} ${cat.text} px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest`}>
            {meta.emoji} {meta.label}
          </span>
          {q.alternativePrompt && (
            <button
              onClick={() => setShowAlt(!showAlt)}
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary transition active:scale-95"
            >
              🔄 {showAlt ? "Original wording" : "Explain differently"}
            </button>
          )}
        </div>
        {isAlternative && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-pulse/40 bg-pulse/10 px-3 py-2 text-xs font-semibold text-pulse">
            <span>🔄</span>
            <span>You were unsure about this sound earlier — here is another angle on it:</span>
          </div>
        )}
        {isConfirming && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500">
            <span>🎯</span>
            <span>Zeroing in: Confirming signature {suspectName ? `"${suspectName}"` : "genre"} sound</span>
          </div>
        )}
        <h2 className="mt-5 text-2xl font-extrabold leading-snug md:text-3xl">
          {showAlt ? q.alternativePrompt : q.question}
        </h2>
        <button onClick={() => setHintOpen(!hintOpen)} className="mt-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-4 transition ${hintOpen ? "rotate-180" : ""}`} /> Hint
        </button>
        {hintOpen && <p className="mt-2 text-sm text-muted-foreground">{q.hint}</p>}
        <div className="mt-8 grid grid-cols-1 gap-2 md:grid-cols-5">
          {RESPONSES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => onRespond(r.value, showAlt || isAlternative)}
              className={`flex items-center justify-between rounded-xl border px-4 py-4 text-left font-bold transition-transform duration-100 active:scale-95 md:flex-col md:justify-center md:gap-1 md:text-center ${RESP_CLASS[i]}`}
            >
              <span>{r.label}</span>
              <kbd className="font-mono text-xs opacity-60">{i + 1}</kbd>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--pulse)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold">{Math.round(value * 100)}%</span>
        <span className="text-xs text-muted-foreground">match</span>
      </div>
    </div>
  );
}

function Diagnosis({
  engine, drill, onDrill, onAgain, onUndo, onWrong, onFlipAnswer,
}: {
  engine: AkinatorEngine; drill: string | null; onDrill: (id: string) => void; onAgain: () => void; onUndo: () => void; onWrong: () => void;
  onFlipAnswer: (attrId: string, newValue: number) => void;
}) {
  const ranked = engine.ranked();
  const top = ranked[0]!;
  const g = top.genre;
  const tension = useMemo(() => engine.computeTension(g), [engine, g]);

  useEffect(() => {
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.4 }, colors: ["#10b981", "#8b5cf6", "#06b6d4", "#f59e0b"] });
  }, [g.id]);

  const hallmarks = useMemo(() => {
    const byCat = new Map<Category, string>();
    const yes = engine.answers
      .filter((a) => a.value > 0 && (g.weights[a.attributeId] ?? 0) > 0)
      .sort((a, b) => (g.weights[b.attributeId] ?? 0) - (g.weights[a.attributeId] ?? 0));
    for (const a of yes) {
      const attr = ATTRIBUTES.find((x) => x.id === a.attributeId)!;
      if (!byCat.has(attr.category)) byCat.set(attr.category, attr.hint);
    }
    return [...byCat.entries()];
  }, [engine, g]);

  const query = encodeURIComponent(`${g.benchmark.artist} ${g.benchmark.title}`);
  const canDrill = !drill && hasSubgenres(g.id);

  return (
    <section className="animate-slide-in space-y-5">
      <div className="rounded-3xl border border-pulse/40 bg-card/80 p-6 backdrop-blur md:p-10">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Diagnosis complete • {engine.questionCount} questions</p>
        <div className="mt-4 flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Gauge value={top.prob} />
          <div>
            {drill && <p className="font-mono text-xs uppercase tracking-widest text-sound">Subgenre of {GENRES.find((x) => x.id === drill)?.name}</p>}
            <h2 className="bg-gradient-to-r from-pulse to-voice bg-clip-text text-5xl font-extrabold tracking-tight text-transparent md:text-6xl">{g.name}</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">{g.summary}</p>
          </div>
        </div>
        {hallmarks.length > 0 && (
          <ul className="mt-6 grid gap-2 md:grid-cols-2">
            {hallmarks.map(([cat, text]) => (
              <li key={cat} className={`rounded-xl border ${CAT_CLASS[cat].border} ${CAT_CLASS[cat].bg} p-3 text-sm`}>
                <span className={`font-mono text-xs font-bold uppercase ${CAT_CLASS[cat].text}`}>{CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}</span>
                <p className="mt-1">{text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {tension.outlier && (
        <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-semibold text-amber-500">
                <span>⚠️</span> Unusual answer noticed
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You answered{" "}
                <span className="font-bold text-foreground">
                  &ldquo;{RESPONSES.find((r) => r.value === tension.outlier!.actual)?.label ?? tension.outlier.actual}&rdquo;
                </span>{" "}
                for{" "}
                <span className="italic font-medium text-foreground">
                  &ldquo;{tension.outlier.attribute.question}&rdquo;
                </span>
                . If this track was actually {tension.outlier.expected > 0 ? "YES" : "NO"}, click to recalculate:
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFlipAnswer(tension.outlier!.attributeId, tension.outlier!.expected > 0 ? 1 : -1)}
              className="shrink-0 border-amber-500/40 text-amber-500 hover:bg-amber-500/20 active:scale-95"
            >
              🔄 Recalculate with {tension.outlier.expected > 0 ? "Yes" : "No"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card/80 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Benchmark track</p>
        <p className="mt-2 text-xl font-extrabold">{g.benchmark.artist} — <span className="italic">{g.benchmark.title}</span></p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" asChild><a href={`https://open.spotify.com/search/${query}`} target="_blank" rel="noreferrer"><Music2 /> Spotify</a></Button>
          <Button variant="secondary" asChild><a href={`https://music.apple.com/search?term=${query}`} target="_blank" rel="noreferrer"><Music2 /> Apple Music</a></Button>
          <Button variant="secondary" asChild><a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer"><Youtube /> YouTube</a></Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card/80 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Runner-ups</p>
        <div className="mt-3 space-y-2">
          {ranked.slice(1, 4).map((r) => (
            <div key={r.genre.id} className="flex items-center gap-3 text-sm">
              <span className="w-36 truncate font-semibold">{r.genre.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-sound" style={{ width: `${r.prob * 100}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-xs">{(r.prob * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canDrill && (
          <Button onClick={() => onDrill(g.id)} className="bg-sound text-foreground hover:bg-sound/80 active:scale-95"><Microscope /> Pinpoint Exact Subgenre</Button>
        )}
        <Button variant="outline" onClick={onWrong} className="active:scale-95"><X /> Wrong Genre? Teach Me</Button>
        <Button variant="ghost" onClick={onUndo} className="active:scale-95"><ChevronLeft /> Change last answer</Button>
        <Button variant="ghost" onClick={onAgain} className="active:scale-95"><RotateCcw /> Play Again</Button>
      </div>
    </section>
  );
}

function FeedbackModal({ open, onOpenChange, engine }: { open: boolean; onOpenChange: (b: boolean) => void; engine: AkinatorEngine }) {
  const [search, setSearch] = useState("");
  const [actual, setActual] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [note, setNote] = useState("");
  const list = GENRES.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  const submit = () => {
    const predictedGenre = engine.ranked()[0]?.genre;
    const actualName = actual ? GENRES.find((g) => g.id === actual)?.name ?? actual : search.trim();
    const sessionId = crypto.randomUUID();

    const trace = {
      sessionId,
      createdAt: new Date().toISOString(),
      answers: engine.answers,
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

    const answerRows = engine.answers
      .map((a, i) => {
        const attr = ATTRIBUTES.find((att) => att.id === a.attributeId);
        const resp = RESPONSES.find((r) => r.value === a.value)?.label ?? String(a.value);
        const qText = attr ? (a.isAlternative && attr.alternativePrompt ? attr.alternativePrompt : attr.question) : a.attributeId;
        return `| ${i + 1} | \`${a.attributeId}\` | ${qText} | **${resp}** |`;
      })
      .join("\n");

    const body = `### 🎵 Genre Correction Report

- **Predicted Genre**: ${predictedGenre ? `${predictedGenre.name} (${(engine.ranked()[0]!.prob * 100).toFixed(1)}%)` : "None"}
- **Actual Genre**: **${actualName}**
- **Audio Sample**: ${audioUrl.trim() ? audioUrl.trim() : "*None provided*"}

---

### 📝 Listener Notes
${note.trim() ? `> ${note.trim().replace(/\n/g, "\n> ")}` : "*No extra notes provided.*"}

---

### 🔍 Session Diagnostic Trace (${engine.answers.length} questions)
<details>
<summary>Click to view asked questions & responses</summary>

| # | Attribute ID | Question Asked | Listener Response |
|---|---|---|---|
${answerRows}

\`\`\`json
${JSON.stringify(trace, null, 2)}
\`\`\`
</details>

---
*Reported from [Genre Genie](https://sonotaxo.github.io/genre-genie/)*
`;

    const issueUrl = `https://github.com/Sonotaxo/genre-genie/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent("calibration,feedback")}`;

    window.open(issueUrl, "_blank", "noopener,noreferrer");
    toast.success("Opening GitHub issue to calibrate the engine. Thank you!");
    onOpenChange(false);
    setSearch("");
    setActual(null);
    setAudioUrl("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>What was the real genre?</DialogTitle>
          <DialogDescription>
            Help calibrate Genre Genie by opening a GitHub issue with your song and perceptual trace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block font-mono text-xs text-muted-foreground uppercase tracking-wider">
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
                  actual === g.id ? "border-primary bg-primary/20 text-primary font-bold" : "border-border hover:border-primary/50"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Audio Sample (optional)
            </label>
            <Input
              placeholder="Link to YouTube, Spotify, SoundCloud, or Bandcamp…"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-xs text-muted-foreground uppercase tracking-wider">
              What sound gave it away? (optional)
            </label>
            <Textarea
              placeholder="e.g. Rolling bassline, squelchy 303 filter, acoustic upright bass, 808 sub…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={submit} disabled={!search.trim()} className="w-full gap-2">
            <ExternalLink className="size-4" /> Open GitHub Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

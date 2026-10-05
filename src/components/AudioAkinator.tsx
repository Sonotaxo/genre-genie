import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ChevronLeft, RotateCcw, Microscope, X, ChevronDown, Music2, Youtube } from "lucide-react";
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

export function AudioAkinator() {
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

  const makeDrill = (parent: string, prior: Answer[]) => {
    const e = new AkinatorEngine({ parent, priorAnswers: prior });
    // mark prior answers as asked so we don't repeat them
    e.answers = prior.map((a) => ({ ...a }));
    return e;
  };

  const respond = useCallback((value: number) => {
    const e = engineRef.current;
    const q = e?.nextQuestion();
    if (!e || !q) return;
    e.answer(q.attribute.id, value);
    setHintOpen(false);
    if (e.isConverged(drill ? 5 + macroAnswers.length : 15)) {
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
    setScreen(engineRef.current.isConverged(5 + prior.length) ? "CONVERGED" : "PLAYING");
    force();
  };

  useEffect(() => {
    if (screen !== "PLAYING") return;
    const onKey = (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= 5) respond(RESPONSES[n - 1]!.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, respond]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-14">
      <header className="mb-8 flex items-center justify-between">
        <button onClick={() => setScreen("IDLE")} className="flex items-center gap-2 font-extrabold tracking-tight">
          <Wave className="text-pulse" /> Audio-Akinator
        </button>
        <span className="font-mono text-xs text-muted-foreground">v1.0 • ENGINE ONLINE</span>
      </header>

      {screen === "IDLE" && <Landing onStart={start} />}
      {screen === "PLAYING" && engine && question && (
        <QuestionView
          key={engine.questionCount + (drill ?? "")}
          engine={engine}
          q={question.attribute}
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
        />
      )}
      {engine && (
        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} engine={engine} />
      )}
    </main>
  );
}

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
          Audio-Akinator will guess its genre.
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
  engine, q, drill, baseCount, hintOpen, setHintOpen, onRespond, onUndo,
}: {
  engine: AkinatorEngine; q: (typeof ATTRIBUTES)[number]; drill: string | null; baseCount: number;
  hintOpen: boolean; setHintOpen: (b: boolean) => void; onRespond: (v: number) => void; onUndo: () => void;
}) {
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
          Q{n} of ~{drill ? 4 : 10}
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
        <span className={`inline-flex items-center gap-2 rounded-full ${cat.bg} ${cat.text} px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest`}>
          {meta.emoji} {meta.label}
        </span>
        <h2 className="mt-5 text-2xl font-extrabold leading-snug md:text-3xl">{q.question}</h2>
        <button onClick={() => setHintOpen(!hintOpen)} className="mt-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-4 transition ${hintOpen ? "rotate-180" : ""}`} /> Hint
        </button>
        {hintOpen && <p className="mt-2 text-sm text-muted-foreground">{q.hint}</p>}
        <div className="mt-8 grid grid-cols-1 gap-2 md:grid-cols-5">
          {RESPONSES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => onRespond(r.value)}
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

function Diagnosis({ engine, drill, onDrill, onAgain, onUndo, onWrong }: {
  engine: AkinatorEngine; drill: string | null; onDrill: (id: string) => void; onAgain: () => void; onUndo: () => void; onWrong: () => void;
}) {
  const ranked = engine.ranked();
  const top = ranked[0]!;
  const g = top.genre;
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
  const [note, setNote] = useState("");
  const list = GENRES.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));
  const submit = () => {
    const trace = {
      sessionId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      answers: engine.answers,
      predicted: engine.ranked()[0]?.genre.id,
      actual: actual ?? search,
      note,
    };
    const key = "audio-akinator-feedback";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
    localStorage.setItem(key, JSON.stringify([...prev, trace]));
    toast.success("Thanks for teaching me! Matrix will learn from your feedback.");
    onOpenChange(false);
    setSearch(""); setActual(null); setNote("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What was the real genre?</DialogTitle>
          <DialogDescription>Help the engine get smarter.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Search genres…" value={search} onChange={(e) => { setSearch(e.target.value); setActual(null); }} />
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {list.map((g) => (
            <button key={g.id} onClick={() => { setActual(g.id); setSearch(g.name); }}
              className={`rounded-full border px-3 py-1 text-xs ${actual === g.id ? "border-primary bg-primary/20" : "border-border"}`}>
              {g.name}
            </button>
          ))}
        </div>
        <Textarea placeholder="What sound gave it away? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={submit} disabled={!search.trim()}>Submit</Button>
      </DialogContent>
    </Dialog>
  );
}

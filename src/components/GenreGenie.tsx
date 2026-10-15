import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ChevronLeft, RotateCcw, Microscope, X, ChevronDown, Music2, Youtube, ExternalLink, Github, Search, HelpCircle, Check } from "lucide-react";
import { AkinatorEngine, RESPONSES, hasSubgenres, type Answer } from "@/engine/engine";
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
  }, [drill, macroAnswers.length]);

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
    setHintOpen(false);

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
    const prior = [...(engineRef.current?.answers ?? [])];
    setMacroAnswers(prior);
    macroRef.current = engineRef.current;
    autoDrillRef.current = false;
    engineRef.current = makeDrill(parent, prior);
    setDrill(parent);
    setScreen(engineRef.current.isConverged(8 + prior.length) ? "CONVERGED" : "PLAYING");
    force();
  };

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
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Sonotaxo/genre-genie"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 font-mono text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground active:scale-95"
          >
            <Github className="size-3.5" />
            <span>Open Source on GitHub</span>
          </a>
        </div>
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
          onSelectGenre={selectGenreEarly}
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

      <SupportedGenresCatalog onStartFamily={(f) => onStart(f)} />

      <div className="mt-16 flex flex-col items-center gap-4 border-t border-border/50 pt-8 text-center">
        <a
          href="https://github.com/Sonotaxo/genre-genie"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-4 py-2 font-mono text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-primary hover:text-foreground active:scale-95"
        >
          <Github className="size-4" />
          <span>Open Source on GitHub</span>
        </a>
        <p className="font-mono text-xs text-muted-foreground">
          {GENRES.length} Genres Cataloged • {ATTRIBUTES.length} Sensory Attributes • 100% In-Browser Engine
        </p>
      </div>
    </section>
  );
}

function SupportedGenresCatalog({ onStartFamily }: { onStartFamily: (f: Family) => void }) {
  const [search, setSearch] = useState("");

  const familyGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const macroGenres = GENRES.filter((g) => g.tier === "macro" || !g.parent);
    const subgenres = GENRES.filter((g) => g.tier === "micro" || g.parent);

    return FAMILIES.map((fam) => {
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
          const parentMatches = parent.name.toLowerCase().includes(q);
          const matchingSubs = subgenres.filter((s) => s.name.toLowerCase().includes(q));
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
    }).filter((f) => f.groups.length > 0);
  }, [search]);

  return (
    <div className="mt-20 border-t border-border/50 pt-12 text-left">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            Supported Genres & Subgenres
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {GENRES.length} total genres cataloged across {FAMILIES.length} musical families (42 macro genres & 35 subgenres).
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search genres & subgenres…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card/60 pl-9 pr-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {familyGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          <p className="text-sm">No genres found matching &ldquo;{search}&rdquo;</p>
          <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="mt-2 text-xs">
            Clear search
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {familyGroups.map(({ family, groups, totalCount }) => (
            <div
              key={family.id}
              className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card/50 p-5 backdrop-blur transition-all duration-200 hover:border-border"
            >
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-foreground">
                    <span className="text-base">{family.emoji}</span>
                    <span>{family.label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {totalCount}
                    </span>
                  </div>
                  <button
                    onClick={() => onStartFamily(family.id)}
                    className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary active:scale-95"
                    title={`Fast-track ${family.label}`}
                  >
                    <span>Fast-track</span>
                    <span>→</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {groups.map(({ parent, subgenres }) => (
                    <div key={parent.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground/90">
                          {parent.name}
                        </span>
                        {subgenres.length > 0 && (
                          <span className="rounded-full border border-pulse/30 bg-pulse/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-pulse">
                            {subgenres.length} subgenres
                          </span>
                        )}
                      </div>

                      {subgenres.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 border-l-2 border-border/60 pl-2">
                          {subgenres.map((sub) => (
                            <span
                              key={sub.id}
                              className="rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                            >
                              {sub.name}
                            </span>
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
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-card/60 p-4">
      <div>
        {canEarlySelect && top && onSelectGenre && (
          <div className="mb-3.5 flex flex-col gap-2 rounded-xl border border-pulse/40 bg-pulse/10 p-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-sm">🎯</span>
              <span className="text-muted-foreground">
                Spot your genre? Is it <strong className="text-foreground">{top.genre.name}</strong>?
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onSelectGenre(top.genre.id)}
              className="h-7 shrink-0 bg-pulse text-xs font-semibold text-primary-foreground hover:bg-pulse/90 active:scale-95"
            >
              <Check className="mr-1 size-3.5" />
              Yes, that&apos;s it!
            </Button>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
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
              <div key={r.genre.id} className="flex items-center gap-3 text-sm">
                <div className="w-36 truncate font-semibold">
                  <span>{r.genre.name}</span>
                  {parentName && (
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
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
                <span className="w-14 text-right font-mono text-xs">{(r.prob * 100).toFixed(1)}%</span>
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

function QuestionView({
  engine, q, isAlternative = false, isConfirming = false, suspectName, drill, baseCount, hintOpen, setHintOpen, onRespond, onUndo, onSelectGenre,
}: {
  engine: AkinatorEngine; q: (typeof ATTRIBUTES)[number]; isAlternative?: boolean; isConfirming?: boolean; suspectName?: string | undefined; drill: string | null; baseCount: number;
  hintOpen: boolean; setHintOpen: (b: boolean) => void; onRespond: (v: number, isAlt?: boolean) => void; onUndo: () => void;
  onSelectGenre?: (genreId: string) => void;
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
          Q{n}
        </span>
      </div>

      {showTwoCards ? (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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
        <div className="mb-4">
          <CandidateCard
            title={isMicroMode ? "Candidate sub-genres" : "Top candidates"}
            candidates={
              isMicroMode
                ? subCandidates
                : parentCandidates.length > 0
                ? parentCandidates
                : subCandidates
            }
            canEarlySelect={isMicroMode ? canEarlySelectSub : canEarlySelectParent}
            onSelectGenre={onSelectGenre}
            showParentTag={isMicroMode}
          />
        </div>
      )}

      {drillName && (
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-sound">🔬 Pinpointing {drillName} subgenre</p>
      )}
      <div className={`animate-slide-in rounded-3xl border ${cat.border} bg-card/80 p-6 backdrop-blur md:p-10`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full ${cat.bg} ${cat.text} px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest`}>
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
                    (Show original)
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRephrased(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1 font-mono text-xs text-muted-foreground transition hover:border-pulse/50 hover:text-foreground active:scale-95"
              >
                <HelpCircle className="size-3.5 text-muted-foreground" />
                <span>Unclear question?</span>
              </button>
            )
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
          {isShowingAlternative ? q.alternativePrompt : q.question}
        </h2>
        <button onClick={() => setHintOpen(!hintOpen)} className="mt-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className={`size-4 transition ${hintOpen ? "rotate-180" : ""}`} /> Hint
        </button>
        {hintOpen && <p className="mt-2 text-sm text-muted-foreground">{q.hint}</p>}
        <div className="mt-8 grid grid-cols-1 gap-2 md:grid-cols-5">
          {RESPONSES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => onRespond(r.value, isShowingAlternative)}
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

  const allSubgenres = useMemo(() => engine.rankedAllSubgenres(), [engine]);
  const topCrossSubgenre = allSubgenres[0];
  const crossSubgenreParent = topCrossSubgenre?.genre.parent
    ? GENRES.find((x) => x.id === topCrossSubgenre.genre.parent)
    : null;

  const query = encodeURIComponent(`${g.benchmark.artist} ${g.benchmark.title}`);
  const canDrill = !drill && hasSubgenres(g.id);

  return (
    <section className="animate-slide-in space-y-5">
      <div className="rounded-3xl border border-pulse/40 bg-card/80 p-6 backdrop-blur md:p-10">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Diagnosis complete • {engine.questionCount} questions</p>
        <div className="mt-4 flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Gauge value={top.prob} />
          <div>
            {g.parent && <p className="font-mono text-xs uppercase tracking-widest text-sound">Subgenre of {GENRES.find((x) => x.id === g.parent)?.name ?? g.parent}</p>}
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

      {topCrossSubgenre && (!drill || topCrossSubgenre.genre.parent !== drill) && topCrossSubgenre.prob >= 0.20 && (
        <div className="rounded-3xl border border-sound/40 bg-sound/10 p-5 text-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-semibold text-sound">
                <span>🎯</span> Top Subgenre Match: {topCrossSubgenre.genre.name}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Across all subgenres, this track strongly matches{" "}
                <span className="font-bold text-foreground">{topCrossSubgenre.genre.name}</span>
                {crossSubgenreParent ? (
                  <> (a subgenre of <span className="font-semibold text-foreground">{crossSubgenreParent.name}</span>)</>
                ) : null}
                {" "}with a <span className="font-bold font-mono text-foreground">{Math.round(topCrossSubgenre.prob * 100)}%</span> match.
              </p>
            </div>
            {topCrossSubgenre.genre.parent && topCrossSubgenre.genre.parent !== drill && (
              <Button
                size="sm"
                onClick={() => onDrill(topCrossSubgenre.genre.parent!)}
                className="shrink-0 bg-sound text-foreground hover:bg-sound/80 active:scale-95"
              >
                <Microscope className="size-4 mr-1.5" />
                Explore {crossSubgenreParent?.name ?? "Family"}
              </Button>
            )}
          </div>
        </div>
      )}

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
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {drill ? "Subgenre Runner-ups" : "Runner-ups"}
        </p>
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

        {!drill && allSubgenres.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Leading Subgenres Across All Families
            </p>
            <div className="space-y-2">
              {allSubgenres.slice(0, 3).map((r) => {
                const parentG = GENRES.find((x) => x.id === r.genre.parent);
                return (
                  <div key={r.genre.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{r.genre.name}</span>
                      {parentG && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {parentG.name}
                        </span>
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

    // Format compact answer rows (attribute ID + answer) to stay safely within URL limits
    const maxUrlAnswers = 35;
    const displayedAnswers = engine.answers.slice(0, maxUrlAnswers);
    const answerRows = displayedAnswers
      .map((a, i) => {
        const resp = RESPONSES.find((r) => r.value === a.value)?.label ?? String(a.value);
        return `| ${i + 1} | \`${a.attributeId}\` | **${resp}** |`;
      })
      .join("\n");

    const overflowNote = engine.answers.length > maxUrlAnswers
      ? `\n\n*... and ${engine.answers.length - maxUrlAnswers} more questions (full list copied to clipboard).*`
      : "";

    // Safely trim note if extraordinarily long to prevent URL length overflow
    const safeNote = note.trim().length > 600 ? `${note.trim().slice(0, 600)}… *(truncated)*` : note.trim();

    const body = `### 🎵 Genre Correction Report

- **Predicted Genre**: ${predictedGenre ? `${predictedGenre.name} (${(engine.ranked()[0]!.prob * 100).toFixed(1)}%)` : "None"}
- **Actual Genre**: **${actualName}**
- **Audio Sample**: ${audioUrl.trim() ? audioUrl.trim() : "*None provided*"}

---

### 📝 Listener Notes
${safeNote ? `> ${safeNote.replace(/\n/g, "\n> ")}` : "*No extra notes provided.*"}

---

### 🔍 Session Diagnostic Trace (${engine.answers.length} questions)
<details open>
<summary>View question responses</summary>

| # | Attribute | Listener Response |
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

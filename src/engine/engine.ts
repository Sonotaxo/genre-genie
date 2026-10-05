import { ATTRIBUTES, GENRES, type Attribute, type Family, type Genre } from "./data";

export const RESPONSES = [
  { value: 1, label: "Yes" },
  { value: 0.5, label: "Probably" },
  { value: 0, label: "Don't Know" },
  { value: -0.5, label: "Probably Not" },
  { value: -1, label: "No" },
] as const;
export type ResponseValue = (typeof RESPONSES)[number]["value"];

export interface Answer { attributeId: string; value: number }

export function likelihood(u: number, weight: number): number {
  return Math.max(0.05, Math.min(0.95, (1 + u * weight) / 2));
}

export function entropy(probs: number[]): number {
  let h = 0;
  for (const p of probs) if (p > 0) h -= p * Math.log2(p);
  return h;
}

function normalize(p: number[]): number[] {
  const s = p.reduce((a, b) => a + b, 0) || 1;
  return p.map((x) => x / s);
}

interface Snapshot { probs: number[]; answers: Answer[]; pruned: string[] }

export class AkinatorEngine {
  candidates: Genre[];
  probs: number[];
  answers: Answer[] = [];
  pruned = new Set<string>();
  private stack: Snapshot[] = [];
  readonly attributes: Attribute[];

  constructor(opts: { family?: Family; parent?: string; priorAnswers?: Answer[]; genres?: Genre[]; attributes?: Attribute[] } = {}) {
    const all = opts.genres ?? GENRES;
    this.attributes = opts.attributes ?? ATTRIBUTES;
    this.candidates = opts.parent
      ? all.filter((g) => g.parent === opts.parent)
      : all.filter((g) => g.parent === null && (!opts.family || g.family === opts.family));
    this.probs = normalize(this.candidates.map((g) => g.popularity));
    for (const a of opts.priorAnswers ?? []) this.applyAnswer(a.attributeId, a.value, false);
  }

  get questionCount() { return this.answers.length; }
  get canUndo() { return this.stack.length > 0; }

  private w(g: Genre, attr: string) { return g.weights[attr] ?? 0; }

  private applyAnswer(attr: string, u: number, record = true) {
    this.probs = normalize(this.probs.map((p, i) => p * likelihood(u, this.w(this.candidates[i]!, attr))));
    if (record) this.answers.push({ attributeId: attr, value: u });
    if (attr === "voice_present" && u <= -0.5) {
      for (const a of this.attributes) if (a.voiceDependent) this.pruned.add(a.id);
    }
  }

  answer(attr: string, u: number) {
    this.stack.push({ probs: [...this.probs], answers: [...this.answers], pruned: [...this.pruned] });
    this.applyAnswer(attr, u);
  }

  undo() {
    const s = this.stack.pop();
    if (!s) return;
    this.probs = s.probs;
    this.answers = s.answers;
    this.pruned = new Set(s.pruned);
  }

  entropy() { return entropy(this.probs); }

  certainty() {
    const m = this.candidates.length;
    if (m <= 1) return 1;
    return Math.max(0, 1 - this.entropy() / Math.log2(m));
  }

  informationGain(attr: string): number {
    const h = this.entropy();
    let expected = 0;
    const preds: number[] = [];
    const posts: number[][] = [];
    for (const r of RESPONSES) {
      const post = this.probs.map((p, i) => p * likelihood(r.value, this.w(this.candidates[i]!, attr)));
      preds.push(post.reduce((a, b) => a + b, 0));
      posts.push(post);
    }
    const tot = preds.reduce((a, b) => a + b, 0);
    posts.forEach((post, k) => { expected += (preds[k]! / tot) * entropy(normalize(post)); });
    return h - expected;
  }

  nextQuestion(): { attribute: Attribute; gain: number } | null {
    const asked = new Set(this.answers.map((a) => a.attributeId));
    let best: { attribute: Attribute; gain: number } | null = null;
    for (const a of this.attributes) {
      if (asked.has(a.id) || this.pruned.has(a.id)) continue;
      const gain = this.informationGain(a.id);
      if (!best || gain > best.gain) best = { attribute: a, gain };
    }
    return best;
  }

  ranked() {
    return this.candidates
      .map((g, i) => ({ genre: g, prob: this.probs[i]! }))
      .sort((a, b) => b.prob - a.prob);
  }

  /** True when one candidate clearly dominates (no further questions needed). */
  isClear(): boolean {
    if (this.candidates.length <= 1) return true;
    const [a, b] = this.ranked();
    return a!.prob >= 0.65 || a!.prob - (b?.prob ?? 0) > 0.35;
  }

  isConverged(maxQuestions = 15): boolean {
    if (this.candidates.length <= 1) return true;
    const [a, b] = this.ranked();
    const n = this.questionCount;
    if (a!.prob >= 0.65) return true;
    if (n >= 3 && a!.prob - (b?.prob ?? 0) > 0.35) return true;
    if (n >= maxQuestions) return true;
    const next = this.nextQuestion();
    return !next || next.gain < 0.005;
  }
}

export function hasSubgenres(id: string) {
  return GENRES.some((g) => g.parent === id);
}

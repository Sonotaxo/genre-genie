import { ATTRIBUTES, GENRES, type Attribute, type Family, type Genre } from "./data";

export const RESPONSES = [
  { value: 1, label: "Yes" },
  { value: 0.5, label: "Probably" },
  { value: 0, label: "Don't Know" },
  { value: -0.5, label: "Probably Not" },
  { value: -1, label: "No" },
] as const;
export type ResponseValue = (typeof RESPONSES)[number]["value"];

export interface Answer {
  attributeId: string;
  value: number;
  isAlternative?: boolean;
}

export function likelihood(u: number, weight: number): number {
  return Math.max(0.05, Math.min(0.95, (1 + u * weight) / 2));
}

export function entropy(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-9) h -= p * Math.log2(p);
  }
  return h;
}

function normalize(p: number[]): number[] {
  const s = p.reduce((a, b) => a + b, 0) || 1;
  return p.map((x) => x / s);
}

interface Snapshot {
  probs: number[];
  answers: Answer[];
  pruned: string[];
  unsureIds: string[];
  retriedIds: string[];
}

export class GenreGenieEngine {
  candidates: Genre[];
  probs: number[];
  answers: Answer[] = [];
  pruned = new Set<string>();
  unsureIds = new Set<string>();
  retriedIds = new Set<string>();
  private stack: Snapshot[] = [];
  readonly attributes: Attribute[];

  constructor(
    opts: {
      family?: Family;
      parent?: string;
      priorAnswers?: Answer[];
      genres?: Genre[];
      attributes?: Attribute[];
    } = {}
  ) {
    const all = opts.genres ?? GENRES;
    this.attributes = opts.attributes ?? ATTRIBUTES;

    if (opts.parent) {
      this.candidates = all.filter((g) => g.parent === opts.parent);
    } else {
      this.candidates = all.filter(
        (g) => g.parent === null && (!opts.family || g.family === opts.family)
      );
    }

    this.probs = normalize(this.candidates.map((g) => g.popularity));

    for (const a of opts.priorAnswers ?? []) {
      this.applyAnswer(a.attributeId, a.value, a.isAlternative ?? false, false);
    }
  }

  get questionCount() {
    return this.answers.length;
  }

  get canUndo() {
    return this.stack.length > 0;
  }

  private w(g: Genre, attr: string) {
    return g.weights[attr] ?? 0;
  }

  private applyAnswer(attr: string, u: number, isAlternative = false, record = true) {
    this.probs = normalize(
      this.probs.map((p, i) => p * likelihood(u, this.w(this.candidates[i]!, attr)))
    );

    if (record) {
      this.answers.push({ attributeId: attr, value: u, isAlternative });

      if (isAlternative) {
        this.retriedIds.add(attr);
        this.unsureIds.delete(attr);
      } else if (u === 0) {
        this.unsureIds.add(attr);
      } else {
        this.unsureIds.delete(attr);
      }
    }

    if (attr === "voice_present" && u <= -0.5) {
      for (const a of this.attributes) {
        if (a.voiceDependent) this.pruned.add(a.id);
      }
    }
  }

  answer(attr: string, u: number, isAlternative = false) {
    this.stack.push({
      probs: [...this.probs],
      answers: [...this.answers],
      pruned: [...this.pruned],
      unsureIds: [...this.unsureIds],
      retriedIds: [...this.retriedIds],
    });
    this.applyAnswer(attr, u, isAlternative);
  }

  undo() {
    const s = this.stack.pop();
    if (!s) return;
    this.probs = s.probs;
    this.answers = s.answers;
    this.pruned = new Set(s.pruned);
    this.unsureIds = new Set(s.unsureIds);
    this.retriedIds = new Set(s.retriedIds);
  }

  entropy() {
    return entropy(this.probs);
  }

  certainty() {
    const m = this.candidates.length;
    if (m <= 1) return 1;
    return Math.max(0, 1 - this.entropy() / Math.log2(m));
  }

  informationGain(attr: string): number {
    const h = this.entropy();
    let expected = 0;

    for (const ans of [1.0, -1.0]) {
      let pAns = 0.0;
      const post: number[] = [];

      for (let i = 0; i < this.candidates.length; i++) {
        const w = this.w(this.candidates[i]!, attr);
        const l = likelihood(ans, w);
        const p = l * this.probs[i]!;
        post.push(p);
        pAns += p;
      }

      if (pAns > 1e-9) {
        const normPost = post.map((x) => x / pAns);
        expected += pAns * entropy(normPost);
      } else {
        expected += h;
      }
    }

    return h - expected;
  }

  nextQuestion(): { attribute: Attribute; gain: number; isAlternative?: boolean } | null {
    const asked = new Set(this.answers.map((a) => a.attributeId));
    let best: { attribute: Attribute; gain: number; isAlternative?: boolean } | null = null;

    // 1. Evaluate unasked attributes
    for (const a of this.attributes) {
      if (asked.has(a.id) || this.pruned.has(a.id)) continue;
      const gain = this.informationGain(a.id);
      if (!best || gain > best.gain) {
        best = { attribute: a, gain, isAlternative: false };
      }
    }

    // 2. Unsure Fallback: Re-prompt high-value unsure questions with alternativePrompt LATER,
    // only after at least 3 other questions have been asked in between (cooldown),
    // and only when it provides strong differentiating value.
    if (this.unsureIds.size > 0 && this.answers.length >= 4) {
      for (const uid of this.unsureIds) {
        if (this.retriedIds.has(uid)) continue;
        const attr = this.attributes.find((a) => a.id === uid);
        if (!attr || !attr.alternativePrompt) continue;

        // Ensure at least 3 questions have been asked since this question was marked unsure
        const lastIdx = this.answers.findLastIndex((ans) => ans.attributeId === uid);
        if (lastIdx !== -1 && this.answers.length - 1 - lastIdx < 3) {
          continue; // Cooldown: do not ask immediately
        }

        const uGain = this.informationGain(uid);
        // Only select alternative prompt if unasked gain is low or uGain is significantly stronger
        const threshold = best ? Math.max(best.gain * 1.5, 0.08) : 0.05;
        if (uGain >= threshold) {
          best = { attribute: attr, gain: uGain, isAlternative: true };
          break;
        }
      }
    }

    return best;
  }

  ranked() {
    return this.candidates
      .map((g, i) => ({ genre: g, prob: this.probs[i]! }))
      .sort((a, b) => b.prob - a.prob);
  }

  /** True when one candidate clearly dominates. */
  isClear(): boolean {
    if (this.candidates.length <= 1) return true;
    const [a, b] = this.ranked();
    return a!.prob >= 0.60 || a!.prob - (b?.prob ?? 0) > 0.35;
  }

  /** Adaptive dynamic convergence without arbitrary hard cutoffs. */
  isConverged(maxQuestions = 25): boolean {
    if (this.candidates.length <= 1) return true;
    const [a, b] = this.ranked();
    const n = this.questionCount;

    if (a!.prob >= 0.60) return true;
    if (n >= 3 && a!.prob - (b?.prob ?? 0) > 0.35) return true;
    if (n >= maxQuestions) return true;

    const next = this.nextQuestion();
    return !next || next.gain < 0.005;
  }
}

export function hasSubgenres(id: string) {
  return GENRES.some((g) => g.parent === id);
}

export const AkinatorEngine = GenreGenieEngine;
export type AkinatorEngine = GenreGenieEngine;

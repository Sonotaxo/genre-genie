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

  /**
   * Recalculates engine state and probabilities from scratch using current answers.
   * Useful when an answer is corrected or flipped.
   */
  recalculate() {
    this.probs = normalize(this.candidates.map((g) => g.popularity));
    this.pruned = new Set<string>();
    this.unsureIds = new Set<string>();
    this.retriedIds = new Set<string>();
    this.stack = [];

    const existing = [...this.answers];
    this.answers = [];
    for (const a of existing) {
      this.applyAnswer(a.attributeId, a.value, a.isAlternative ?? false, true);
    }
  }

  updateProbabilities() {
    this.recalculate();
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

  getConfirmedHallmarkDimensions(g: Genre): Set<string> {
    const dimensions = new Set<string>();
    for (const ans of this.answers) {
      if (ans.value < 0.5) continue;
      const w = this.w(g, ans.attributeId);
      // Confirmed if strong positive hallmark matched affirmative listener response
      if (w >= 0.6) {
        const attr = this.attributes.find((a) => a.id === ans.attributeId);
        if (attr) dimensions.add(attr.category);
      }
    }
    return dimensions;
  }

  findConfirmingQuestion(suspect: Genre, runners: Genre[]): { attribute: Attribute; gain: number } | null {
    const asked = new Set(this.answers.map((a) => a.attributeId));
    let bestAttr: Attribute | null = null;
    let bestScore = -1;

    for (const a of this.attributes) {
      if (asked.has(a.id) || this.pruned.has(a.id)) continue;
      const wSuspect = this.w(suspect, a.id);
      const wRunner1 = runners[0] ? this.w(runners[0], a.id) : 0;
      const wRunner2 = runners[1] ? this.w(runners[1], a.id) : 0;
      const diff1 = Math.abs(wSuspect - wRunner1);
      const diff2 = Math.abs(wSuspect - wRunner2);

      const maxWeight = Math.max(Math.abs(wSuspect), Math.abs(wRunner1));
      if (maxWeight < 0.6 || diff1 < 0.4) continue;

      const score = maxWeight * (diff1 * 1.5 + diff2);
      if (score > bestScore) {
        bestScore = score;
        bestAttr = a;
      }
    }

    if (!bestAttr) return null;
    return { attribute: bestAttr, gain: this.informationGain(bestAttr.id) };
  }

  computeTension(g: Genre): {
    score: number;
    outlier?: { attributeId: string; expected: number; actual: number; delta: number; attribute: Attribute };
  } {
    let total = 0;
    let worstOutlier: { attributeId: string; expected: number; actual: number; delta: number; attribute: Attribute } | undefined;

    for (const ans of this.answers) {
      if (ans.value === 0) continue;
      const expected = this.w(g, ans.attributeId);
      const delta = Math.abs(expected - ans.value);
      total += delta;

      if (delta >= 1.4 && (!worstOutlier || delta > worstOutlier.delta)) {
        const attr = this.attributes.find((a) => a.id === ans.attributeId);
        if (attr) {
          worstOutlier = {
            attributeId: ans.attributeId,
            expected,
            actual: ans.value,
            delta,
            attribute: attr,
          };
        }
      }
    }

    return worstOutlier ? { score: total, outlier: worstOutlier } : { score: total };
  }

  nextQuestion(): {
    attribute: Attribute;
    gain: number;
    isAlternative?: boolean;
    isConfirming?: boolean;
    suspectName?: string;
  } | null {
    const asked = new Set(this.answers.map((a) => a.attributeId));
    const ranked = this.ranked();
    const top = ranked[0];
    const runner = ranked[1];
    const margin = runner ? top!.prob - runner.prob : 1.0;

    // 1. Check if we should ask a Confirming / Hallmark Question
    // Trigger when we have asked at least 4 questions and top candidate is a strong suspect
    if (this.answers.length >= 4 && top && (top.prob >= 0.50 || margin >= 0.25)) {
      const confirming = this.findConfirmingQuestion(top.genre, ranked.slice(1, 3).map((r) => r.genre));
      if (confirming) {
        return {
          attribute: confirming.attribute,
          gain: confirming.gain,
          isConfirming: true,
          suspectName: top.genre.name,
        };
      }
    }

    // 2. Standard Information Gain across unasked attributes
    let best: { attribute: Attribute; gain: number; isAlternative?: boolean; isConfirming?: boolean; suspectName?: string } | null = null;
    for (const a of this.attributes) {
      if (asked.has(a.id) || this.pruned.has(a.id)) continue;
      const gain = this.informationGain(a.id);
      if (!best || gain > best.gain) {
        best = { attribute: a, gain, isAlternative: false };
      }
    }

    // 3. Unsure Fallback: Re-prompt high-value unsure questions with alternativePrompt LATER,
    // only after at least 3 other questions have been asked in between (cooldown),
    // and only when it provides strong differentiating value.
    if (this.unsureIds.size > 0 && this.answers.length >= 4) {
      for (const uid of this.unsureIds) {
        if (this.retriedIds.has(uid)) continue;
        const attr = this.attributes.find((a) => a.id === uid);
        if (!attr || !attr.alternativePrompt) continue;

        // Ensure at least 3 questions have been asked since this question was marked unsure
        let lastIdx = -1;
        for (let i = this.answers.length - 1; i >= 0; i--) {
          if (this.answers[i]!.attributeId === uid) {
            lastIdx = i;
            break;
          }
        }
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

  /** True when one candidate clearly dominates with high confidence. */
  isClear(): boolean {
    if (this.candidates.length <= 1) return true;
    const [a, b] = this.ranked();
    const margin = b ? a!.prob - b.prob : 1.0;
    return a!.prob >= 0.75 && margin >= 0.40;
  }

  /** High-accuracy convergence requiring confidence, decisive margins, and hallmark quorum. */
  isConverged(maxQuestions = 25): boolean {
    if (this.candidates.length <= 1) return true;
    const [a, b] = this.ranked();
    const n = this.questionCount;
    const margin = b ? a!.prob - b.prob : 1.0;
    const isMicro = this.candidates.some((c) => c.parent !== null);
    const minQuestions = isMicro ? 3 : 6;

    if (n >= maxQuestions) return true;

    if (n >= minQuestions) {
      const quorum = this.getConfirmedHallmarkDimensions(a!.genre).size >= (isMicro ? 1 : 2);

      // High confidence (>=80% prob, >=45% margin) and quorum verified
      if (a!.prob >= 0.80 && margin >= 0.45 && quorum) return true;

      // Decisive dominance (>=88% prob, >=55% margin)
      if (a!.prob >= 0.88 && margin >= 0.55) return true;
    }

    const next = this.nextQuestion();
    return !next || next.gain < 0.005;
  }
}

export function hasSubgenres(id: string) {
  return GENRES.some((g) => g.parent === id);
}

export const AkinatorEngine = GenreGenieEngine;
export type AkinatorEngine = GenreGenieEngine;

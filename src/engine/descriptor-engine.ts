import descriptorQuestionsData from "../../data/descriptor-questions.json";
import { ATTRIBUTES, GENRES, type Category, type Genre } from "./data";
import { entropy, likelihood, type Answer } from "./engine";

export interface DescriptorOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
  effects: Record<string, number>;
}

export interface DescriptorQuestion {
  id: string;
  category: Category;
  question: string;
  subtitle: string;
  hint: string;
  options: DescriptorOption[];
}

export interface DescriptorAnswer {
  questionId: string;
  optionId: string;
}

interface Snapshot {
  probs: number[];
  descriptorAnswers: DescriptorAnswer[];
  askedQuestionIds: string[];
}

function normalize(p: number[]): number[] {
  const s = p.reduce((a, b) => a + b, 0) || 1;
  return p.map((x) => x / s);
}

export class DescriptorEngine {
  readonly allGenres: Genre[];
  readonly questions: DescriptorQuestion[];
  candidates: Genre[];
  probs: number[];
  descriptorAnswers: DescriptorAnswer[] = [];
  askedQuestionIds = new Set<string>();
  private stack: Snapshot[] = [];

  constructor(opts: { genres?: Genre[]; questions?: DescriptorQuestion[] } = {}) {
    this.allGenres = opts.genres ?? GENRES;
    this.candidates = [...this.allGenres];
    this.questions = (opts.questions ?? (descriptorQuestionsData as any)) as DescriptorQuestion[];
    this.probs = normalize(this.candidates.map((g) => g.popularity));
  }

  get questionCount() {
    return this.descriptorAnswers.length;
  }

  get canUndo() {
    return this.stack.length > 0;
  }

  get answers(): Answer[] {
    const list: Answer[] = [];
    for (const ans of this.descriptorAnswers) {
      const q = this.questions.find((x) => x.id === ans.questionId);
      const opt = q?.options.find((o) => o.id === ans.optionId);
      if (opt) {
        for (const [attrId, val] of Object.entries(opt.effects)) {
          list.push({ attributeId: attrId, value: val });
        }
      }
    }
    return list;
  }

  computeTension(g: Genre): {
    score: number;
    outlier?: { attributeId: string; expected: number; actual: number; delta: number; attribute: any };
  } {
    let total = 0;
    let worstOutlier: any = undefined;

    for (const ans of this.answers) {
      if (ans.value === 0) continue;
      const expected = g.weights[ans.attributeId] ?? 0;
      const delta = Math.abs(expected - ans.value);
      total += delta;

      if (delta >= 1.4 && (!worstOutlier || delta > worstOutlier.delta)) {
        const attr = ATTRIBUTES.find((a) => a.id === ans.attributeId);
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

    return { score: total, outlier: worstOutlier };
  }

  answer(questionId: string, optionId: string) {
    this.stack.push({
      probs: [...this.probs],
      descriptorAnswers: [...this.descriptorAnswers],
      askedQuestionIds: [...this.askedQuestionIds],
    });

    this.applyAnswer(questionId, optionId);
  }

  private applyAnswer(questionId: string, optionId: string) {
    const q = this.questions.find((x) => x.id === questionId);
    if (!q) return;
    const opt = q.options.find((o) => o.id === optionId);
    if (!opt) return;

    this.descriptorAnswers.push({ questionId, optionId });
    this.askedQuestionIds.add(questionId);

    // Apply attribute effect multipliers for the chosen sensory option
    for (const [attrId, val] of Object.entries(opt.effects)) {
      this.probs = normalize(
        this.probs.map((p, i) => {
          const w = this.candidates[i]!.weights[attrId] ?? 0;
          return p * likelihood(val, w);
        })
      );
    }
  }

  undo() {
    const s = this.stack.pop();
    if (!s) return;
    this.probs = s.probs;
    this.descriptorAnswers = s.descriptorAnswers;
    this.askedQuestionIds = new Set(s.askedQuestionIds);
  }

  recalculate() {
    this.probs = normalize(this.candidates.map((g) => g.popularity));
    const oldAnswers = [...this.descriptorAnswers];
    this.descriptorAnswers = [];
    this.askedQuestionIds.clear();
    for (const a of oldAnswers) {
      this.applyAnswer(a.questionId, a.optionId);
    }
  }

  certainty(): number {
    const sorted = [...this.probs].sort((a, b) => b - a);
    const top = sorted[0] ?? 0;
    const second = sorted[1] ?? 0;
    const diff = top - second;
    return Math.min(1, top * 0.7 + diff * 0.3);
  }

  ranked(): { genre: Genre; prob: number }[] {
    return this.candidates
      .map((genre, i) => ({ genre, prob: this.probs[i]! }))
      .sort((a, b) => b.prob - a.prob);
  }

  rankedAllSubgenres(): { genre: Genre; prob: number }[] {
    const subgenres = this.allGenres.filter((g) => g.parent !== null || g.tier === "micro");
    const subIndices = subgenres.map((sg) => this.candidates.findIndex((c) => c.id === sg.id));

    const rawSubProbs = subIndices.map((idx) => (idx !== -1 ? this.probs[idx]! : 0));
    const normalized = normalize(rawSubProbs);

    return subgenres
      .map((genre, i) => ({ genre, prob: normalized[i]! }))
      .sort((a, b) => b.prob - a.prob);
  }

  /**
   * Information Gain for a multi-choice descriptor question:
   * IG(Q) = H(current) - sum_k [ P(Option_k) * H(posterior_k) ]
   */
  informationGain(question: DescriptorQuestion): number {
    const currentH = entropy(this.probs);
    let expectedH = 0;

    for (const opt of question.options) {
      if (Object.keys(opt.effects).length === 0) continue; // Unsure option

      // Compute likelihood of this option across candidates
      const optionLikelihoods = this.candidates.map((g) => {
        let l = 1;
        for (const [attrId, val] of Object.entries(opt.effects)) {
          const w = g.weights[attrId] ?? 0;
          l *= likelihood(val, w);
        }
        return l;
      });

      const pOption = this.probs.reduce((sum, p, i) => sum + p * optionLikelihoods[i]!, 0);
      if (pOption <= 1e-6) continue;

      const posterior = normalize(this.probs.map((p, i) => p * optionLikelihoods[i]!));
      expectedH += pOption * entropy(posterior);
    }

    return Math.max(0, currentH - expectedH);
  }

  nextQuestion(): DescriptorQuestion | null {
    const remaining = this.questions.filter((q) => !this.askedQuestionIds.has(q.id));
    if (remaining.length === 0) return null;

    // Grounding priority for the first 3 questions
    if (this.questionCount === 0) {
      const q = remaining.find((x) => x.id === "core_instrumentation");
      if (q) return q;
    }
    if (this.questionCount === 1) {
      const q = remaining.find((x) => x.id === "rhythm_pattern");
      if (q) return q;
    }
    if (this.questionCount === 2) {
      const q = remaining.find((x) => x.id === "tempo_pace");
      if (q) return q;
    }

    // Otherwise, select highest Information Gain
    let bestQ = remaining[0]!;
    let bestGain = -Infinity;

    for (const q of remaining) {
      const gain = this.informationGain(q);
      if (gain > bestGain) {
        bestGain = gain;
        bestQ = q;
      }
    }

    return bestQ;
  }

  isConverged(maxQuestions = 8): boolean {
    if (this.questionCount >= maxQuestions) return true;
    if (this.questionCount < 4) return false;

    const ranked = this.ranked();
    const top = ranked[0];
    const second = ranked[1];
    if (!top) return false;

    if (top.prob >= 0.70) return true;
    if (second && top.prob >= 0.50 && top.prob - second.prob >= 0.30) return true;

    return false;
  }

  /**
   * Returns top candidate genres (or subgenres when drilling) that gain the most confidence
   * if the user selects this descriptor option.
   */
  getGainingGenres(option: DescriptorOption, maxCount = 3): string[] {
    if (Object.keys(option.effects).length === 0) return [];
    const currentProbs = this.probs;
    const candidates = this.candidates;

    const unnormalized = currentProbs.map((p, i) => {
      let l = 1;
      for (const [attrId, val] of Object.entries(option.effects)) {
        l *= likelihood(val, candidates[i]!.weights[attrId] ?? 0);
      }
      return p * l;
    });
    const sum = unnormalized.reduce((a, b) => a + b, 0) || 1;
    const posterior = unnormalized.map((x) => x / sum);

    // Defining positive attributes of this option (e.g. effects >= 0.5)
    const positiveAttrs = Object.entries(option.effects).filter(([_, val]) => val >= 0.5);

    const gains = candidates
      .map((genre, i) => {
        // A genre cannot contradict any strong effect in this option
        const contradicts = Object.entries(option.effects).some(([attrId, val]) => {
          const w = genre.weights[attrId] ?? 0;
          return (val >= 0.5 && w < -0.2) || (val <= -0.5 && w > 0.2);
        });

        // For options with defining positive attributes, the genre must actually feature at least one of them
        const supportsPositive =
          positiveAttrs.length === 0 ||
          positiveAttrs.some(([attrId]) => (genre.weights[attrId] ?? 0) >= 0.15);

        return {
          name: genre.name,
          delta: posterior[i]! - currentProbs[i]!,
          posteriorProb: posterior[i]!,
          valid: !contradicts && supportsPositive,
        };
      })
      .filter((x) => x.valid && x.delta > 0.005)
      .sort((a, b) => b.delta - a.delta);

    return gains.slice(0, maxCount).map((x) => x.name);
  }
}

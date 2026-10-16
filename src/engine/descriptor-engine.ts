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
  hint?: string;
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

function getOptionEffects(q: DescriptorQuestion, opt: DescriptorOption): Record<string, number> {
  if (Object.keys(opt.effects).length > 0) {
    return opt.effects;
  }
  // Option 4 ("Don't Know / Neither"): infer mild negative (-0.55) on the defining positive attributes (val >= 0.9) of Options 1..3
  const implicit: Record<string, number> = {};
  for (const other of q.options.slice(0, 3)) {
    for (const [attr, val] of Object.entries(other.effects)) {
      if (val >= 0.9 && attr !== "voice_present") {
        implicit[attr] = -0.55;
      }
    }
  }
  return implicit;
}

function optionLikelihoodForGenre(effects: Record<string, number>, gWeights: Record<string, number>): number {
  const entries = Object.entries(effects);
  if (entries.length === 0) return 0.5;
  let prod = 1;
  for (const [attr, val] of entries) {
    prod *= likelihood(val, gWeights[attr] ?? 0);
  }
  return Math.pow(prod, 1.5 / entries.length);
}

export class DescriptorEngine {
  readonly allGenres: Genre[];
  readonly questions: DescriptorQuestion[];
  candidates: Genre[];
  probs: number[];
  descriptorAnswers: DescriptorAnswer[] = [];
  askedQuestionIds = new Set<string>();
  private stack: Snapshot[] = [];

  constructor(
    opts: {
      genres?: Genre[];
      questions?: DescriptorQuestion[];
      priorDescriptorAnswers?: DescriptorAnswer[];
    } = {}
  ) {
    this.allGenres = opts.genres ?? GENRES;
    this.candidates = [...this.allGenres];
    this.questions = (opts.questions ?? (descriptorQuestionsData as any)) as DescriptorQuestion[];
    this.probs = normalize(this.candidates.map((g) => g.popularity));

    if (opts.priorDescriptorAnswers) {
      for (const ans of opts.priorDescriptorAnswers) {
        this.applyAnswer(ans.questionId, ans.optionId);
      }
    }
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
      if (q && opt) {
        const effects = getOptionEffects(q, opt);
        for (const [attrId, val] of Object.entries(effects)) {
          list.push({ attributeId: attrId, value: val });
        }
      }
    }
    return list;
  }

  computeTension(g: Genre): {
    score: number;
    outlier?: {
      attributeId: string;
      expected: number;
      actual: number;
      delta: number;
      attribute: any;
      descriptorQuestionId?: string;
      descriptorQuestionText?: string;
      chosenOptionId?: string;
      chosenOptionLabel?: string;
      suggestedOptionId?: string;
      suggestedOptionLabel?: string;
    };
  } {
    let total = 0;
    let worstOutlier: any = undefined;

    for (const ans of this.descriptorAnswers) {
      const q = this.questions.find((x) => x.id === ans.questionId);
      const opt = q?.options.find((o) => o.id === ans.optionId);
      if (!q || !opt) continue;

      const effects = getOptionEffects(q, opt);
      for (const [attrId, val] of Object.entries(effects)) {
        if (val === 0) continue;
        const expected = g.weights[attrId] ?? 0;
        const delta = Math.abs(expected - val);
        total += delta;

        if (delta >= 1.4 && (!worstOutlier || delta > worstOutlier.delta)) {
          const attr = ATTRIBUTES.find((a) => a.id === attrId);
          if (attr) {
            // Find which option in q best matches genre g
            let bestOpt = q.options[3] ?? opt;
            let bestLike = -1;
            for (const candidateOpt of q.options) {
              if (candidateOpt.id === opt.id) continue;
              const l = optionLikelihoodForGenre(getOptionEffects(q, candidateOpt), g.weights);
              if (l > bestLike) {
                bestLike = l;
                bestOpt = candidateOpt;
              }
            }

            worstOutlier = {
              attributeId: attrId,
              expected,
              actual: val,
              delta,
              attribute: attr,
              descriptorQuestionId: q.id,
              descriptorQuestionText: q.question,
              chosenOptionId: opt.id,
              chosenOptionLabel: `${opt.emoji} ${opt.label}`,
              suggestedOptionId: bestOpt.id,
              suggestedOptionLabel: `${bestOpt.emoji} ${bestOpt.label}`,
            };
          }
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

  updateAnswer(questionId: string, newOptionId: string): boolean {
    const existing = this.descriptorAnswers.find((a) => a.questionId === questionId);
    if (!existing) return false;

    this.stack.push({
      probs: [...this.probs],
      descriptorAnswers: this.descriptorAnswers.map((a) => ({ ...a })),
      askedQuestionIds: [...this.askedQuestionIds],
    });

    existing.optionId = newOptionId;
    this.recalculate();
    return true;
  }

  private applyAnswer(questionId: string, optionId: string) {
    const q = this.questions.find((x) => x.id === questionId);
    if (!q) return;
    const opt = q.options.find((o) => o.id === optionId);
    if (!opt) return;

    this.descriptorAnswers.push({ questionId, optionId });
    this.askedQuestionIds.add(questionId);

    const effects = getOptionEffects(q, opt);
    // Apply attribute effect multipliers for the chosen sensory option
    for (const [attrId, val] of Object.entries(effects)) {
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

    // Scale by the probability mass of subgenres and their parent macro genres so non-subgenre families
    // (like Rock, Metal, Country, Classical, Folk) don't hallucinate 99% subgenre matches
    const parentsWithSubs = new Set(subgenres.map((sg) => sg.parent).filter(Boolean));
    const viableSubMass = this.candidates.reduce((sum, c, i) => {
      if (c.parent !== null || c.tier === "micro" || parentsWithSubs.has(c.id)) {
        return sum + (this.probs[i] ?? 0);
      }
      return sum;
    }, 0);
    const scale = Math.min(1, viableSubMass * 2.0);

    return subgenres
      .map((genre, i) => ({ genre, prob: normalized[i]! * scale }))
      .sort((a, b) => b.prob - a.prob);
  }

  private isPruned(q: DescriptorQuestion): boolean {
    const ansMap = new Map(this.descriptorAnswers.map((a) => [a.questionId, a.optionId]));
    // 1. Don't ask vocal_style before vocal_delivery, or if purely_instrumental was chosen
    if (q.id === "vocal_style") {
      const vd = ansMap.get("vocal_delivery");
      if (!vd || vd === "purely_instrumental") return true;
    }
    // 2. Don't ask guitar_style if electronic_synths was chosen
    if (q.id === "guitar_style") {
      const ci = ansMap.get("core_instrumentation");
      if (ci === "electronic_synths") return true;
    }
    // 3. Don't ask synth_character if acoustic_wooden or electric_guitars was chosen
    if (q.id === "synth_character") {
      const ci = ansMap.get("core_instrumentation");
      if (ci === "acoustic_wooden" || ci === "electric_guitars") return true;
    }
    // 4. Don't ask fast_pulse_drive if slow_meditative or moderate_walking was chosen
    if (q.id === "fast_pulse_drive") {
      const tp = ansMap.get("tempo_pace");
      if (tp === "slow_meditative" || tp === "moderate_walking") return true;
    }
    // 5. Don't ask meter_breathing if a clear drum beat or fast club tempo was chosen
    if (q.id === "meter_breathing") {
      const rp = ansMap.get("rhythm_pattern");
      const tp = ansMap.get("tempo_pace");
      if (
        rp === "four_on_floor" ||
        rp === "syncopated_breakbeat" ||
        rp === "halftime_sway" ||
        tp === "fast_club"
      ) {
        return true;
      }
    }
    // 6. Don't ask specialty_rhythm if four_on_floor was chosen
    if (q.id === "specialty_rhythm") {
      const rp = ansMap.get("rhythm_pattern");
      if (rp === "four_on_floor") return true;
    }
    return false;
  }

  /**
   * Information Gain for a 4-option descriptor question across the normalized 4-branch partition:
   * IG(Q) = H(current) - sum_{k=0..3} [ P(Option_k) * H(posterior_k) ]
   */
  informationGain(question: DescriptorQuestion): number {
    const currentH = entropy(this.probs);
    const numOpts = question.options.length;
    const branchProbs = new Array<number>(numOpts).fill(0);
    const branchPosteriors: number[][] = [];

    const optEffects = question.options.map((o) => getOptionEffects(question, o));
    const rawLikes: number[][] = this.candidates.map((g) =>
      optEffects.map((eff) => optionLikelihoodForGenre(eff, g.weights))
    );

    for (let k = 0; k < numOpts; k++) {
      const unnorm = this.probs.map((p, i) => p * rawLikes[i]![k]!);
      const sum = unnorm.reduce((a, b) => a + b, 0);
      branchProbs[k] = sum;
      branchPosteriors[k] = normalize(unnorm);
    }

    const totalBranchP = branchProbs.reduce((a, b) => a + b, 0) || 1;
    let expectedH = 0;
    for (let k = 0; k < numOpts; k++) {
      expectedH += (branchProbs[k]! / totalBranchP) * entropy(branchPosteriors[k]!);
    }

    // Deprioritize questions where >85% of probability mass falls into Option 4 ("Neither")
    const activeMass =
      branchProbs.slice(0, Math.min(3, numOpts)).reduce((a, b) => a + b, 0) / totalBranchP;
    let baseGain = Math.max(0, (currentH - expectedH) * Math.min(1, activeMass * 1.6));

    // Top-5 contender disambiguation bonus
    const top5 = this.ranked().slice(0, 5);
    let splitsTop5 = false;
    for (const opt of question.options.slice(0, 3)) {
      for (const [attr, val] of Object.entries(opt.effects)) {
        if (val >= 0.8) {
          const hasHigh = top5.some((r) => (r.genre.weights[attr] ?? 0) >= 0.75 && r.prob >= 0.04);
          const hasLow = top5.some((r) => (r.genre.weights[attr] ?? 0) <= 0.1 && r.prob >= 0.04);
          if (hasHigh && hasLow) {
            splitsTop5 = true;
            break;
          }
        }
      }
      if (splitsTop5) break;
    }
    if (splitsTop5) {
      baseGain *= 1.35;
    }

    return baseGain;
  }

  nextQuestion(): DescriptorQuestion | null {
    const remaining = this.questions.filter((q) => !this.askedQuestionIds.has(q.id) && !this.isPruned(q));
    if (remaining.length === 0) return null;

    // Grounding priority for the first 4 questions
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
    if (this.questionCount === 3) {
      const q = remaining.find((x) => x.id === "vocal_delivery");
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

  isConverged(maxQuestions = 10): boolean {
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

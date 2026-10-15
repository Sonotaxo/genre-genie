import attributesData from "../../data/attributes.json";
import genresData from "../../data/genres.json";
import matrixData from "../../data/matrix.json";

export type Category = "pulse" | "sound" | "voice" | "atmosphere";

export type Family =
  | "electronic"
  | "rock"
  | "metal"
  | "hip_hop"
  | "rnb_soul_funk"
  | "jazz"
  | "blues"
  | "country"
  | "classical"
  | "folk_acoustic"
  | "reggae_caribbean"
  | "latin_global";

export interface Attribute {
  id: string;
  category: Category;
  question: string;
  alternativePrompt: string;
  hint: string;
  polarOpposite: string;
  voiceDependent?: boolean;
}

export interface BenchmarkTrack {
  artist: string;
  title: string;
}

export interface Genre {
  id: string;
  name: string;
  family: Family;
  tier: "macro" | "micro";
  parent: string | null;
  parentGenreName?: string;
  popularity: number;
  summary: string;
  benchmark: BenchmarkTrack;
  benchmarkTracks: BenchmarkTrack[];
  sensoryHallmarks: {
    pulse: string;
    sound: string;
    voice: string;
    atmosphere: string;
  };
  distinctionNotes: string;
  weights: Record<string, number>;
}

export const FAMILIES: { id: Family; label: string; emoji: string }[] = [
  { id: "electronic", label: "Electronic & Dance", emoji: "⚡" },
  { id: "rock", label: "Rock & Alternative", emoji: "🎸" },
  { id: "metal", label: "Heavy Metal", emoji: "🤘" },
  { id: "hip_hop", label: "Hip-Hop & Rap", emoji: "🎤" },
  { id: "rnb_soul_funk", label: "R&B, Soul & Funk", emoji: "✨" },
  { id: "jazz", label: "Jazz & Swing", emoji: "🎷" },
  { id: "blues", label: "Blues", emoji: "🪕" },
  { id: "country", label: "Country & Bluegrass", emoji: "🤠" },
  { id: "classical", label: "Classical & Orchestra", emoji: "🎻" },
  { id: "folk_acoustic", label: "Folk & Acoustic", emoji: "🪵" },
  { id: "reggae_caribbean", label: "Reggae & Caribbean", emoji: "🌴" },
  { id: "latin_global", label: "Latin & Global", emoji: "💃" },
];

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  pulse: { label: "The Pulse", emoji: "🟢" },
  sound: { label: "The Sound", emoji: "🟣" },
  voice: { label: "The Voice", emoji: "🔵" },
  atmosphere: { label: "The Atmosphere", emoji: "🟠" },
};

function normalizeCategory(raw: string): Category {
  if (raw === "atmo" || raw === "atmosphere") return "atmosphere";
  if (raw === "pulse" || raw === "sound" || raw === "voice") return raw;
  return "sound";
}

export const ATTRIBUTES: Attribute[] = attributesData.map((a: any) => ({
  id: a.id,
  category: normalizeCategory(a.category),
  question: a.prompt,
  alternativePrompt: a.alternativePrompt || a.prompt,
  hint: a.hint,
  polarOpposite: a.polarOpposite || "",
  voiceDependent: a.category === "voice" && a.id !== "voice_present",
}));

export const GENRES: Genre[] = genresData.map((g: any) => {
  const rawRow = (matrixData as Record<string, Record<string, number>>)[g.id] || {};
  const row = { ...rawRow };
  if (
    (row["voice_present"] === undefined || row["voice_present"] === 0) &&
    (((row["voice_clean_melodic"] ?? 0) > 0.4) ||
      ((row["voice_screaming_growls"] ?? 0) > 0.4) ||
      ((row["voice_rapping_spoken"] ?? 0) > 0.4))
  ) {
    row["voice_present"] = 0.9;
  }
  return {
    id: g.id,
    name: g.name,
    family: g.familyId as Family,
    tier: g.tier,
    parent: g.parentGenreId ?? null,
    parentGenreName: g.parentGenreName,
    popularity: g.popularityWeight,
    summary: g.description,
    benchmark: g.benchmarkTracks?.[0] ?? { artist: "Unknown", title: "Landmark Track" },
    benchmarkTracks: g.benchmarkTracks ?? [],
    sensoryHallmarks: g.sensoryHallmarks ?? { pulse: "", sound: "", voice: "", atmosphere: "" },
    distinctionNotes: g.distinctionNotes ?? "",
    weights: row,
  };
});

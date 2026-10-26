export const CATEGORIES = [
  "Board",
  "Card",
  "Party",
  "Puzzle",
  "Deception",
  "Strategy",
  "Skill",
  "Knowledge",
  "Luck",
  "Cooperative/Teams",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RATING_KEYS = [
  "personal",
  "easeOfLearning",
  "easeOfPlaying",
  "speed",
  "repeatability",
  "originality",
] as const;
export type RatingKey = (typeof RATING_KEYS)[number];

export const RATING_LABELS: Record<RatingKey, string> = {
  personal: "Personal Rating",
  easeOfLearning: "Ease of Learning",
  easeOfPlaying: "Ease of Playing",
  speed: "Speed of Game",
  repeatability: "Repeatability",
  originality: "Originality",
};

export interface Ratings {
  personal: number | null;
  easeOfLearning: number | null;
  easeOfPlaying: number | null;
  speed: number | null;
  repeatability: number | null;
  originality: number | null;
}

export interface Game {
  id: string;
  row: number;
  name: string;
  ratings: Ratings;
  total: number | null;
  rank: number | null;
  lastPlayedDate: string | null;
  daysSince: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  recommended: number | null;
  bestPrice: string | null;
  categories: string[];
  playedWithMason: boolean;
}

export interface Filters {
  players: number | null;
  categories: string[];
  masonFilter: "any" | "played" | "notPlayed";
}

export function filterGames(games: Game[], f: Filters): Game[] {
  return games.filter((g) => {
    if (f.players != null) {
      const min = g.minPlayers ?? 1;
      const max = g.maxPlayers ?? 99;
      if (f.players < min || f.players > max) return false;
    }
    if (f.categories.length > 0) {
      const gcats = new Set(g.categories);
      if (!f.categories.every((c) => gcats.has(c))) return false;
    }
    if (f.masonFilter === "played" && !g.playedWithMason) return false;
    if (f.masonFilter === "notPlayed" && g.playedWithMason) return false;
    return true;
  });
}

export function pickRandom(games: Game[]): Game | null {
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}

export function daysSinceLabel(g: Game): string {
  if (g.daysSince == null) return "never played";
  if (g.daysSince === 0) return "played today";
  if (g.daysSince === 1) return "1 day ago";
  return `${g.daysSince} days ago`;
}

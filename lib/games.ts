import rawGames from "@/data/games.json";

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

export interface Game {
  id: string;
  name: string;
  rating: number | null;
  total: number | null;
  rank: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  recommended: number | null;
  bestPrice: string | null;
  categories: string[];
  playedWithMason: boolean;
}

export const GAMES: Game[] = rawGames as Game[];

export interface Filters {
  players: number | null;
  categories: string[]; // must match ALL selected
  masonFilter: "any" | "played" | "notPlayed";
  usePreferredCount: boolean; // true = use recommended count range, false = min..max
}

export function filterGames(games: Game[], f: Filters): Game[] {
  return games.filter((g) => {
    // Player count
    if (f.players != null) {
      const min = g.minPlayers ?? 1;
      const max = g.maxPlayers ?? 99;
      if (f.players < min || f.players > max) return false;
    }
    // Categories — game must include every selected category
    if (f.categories.length > 0) {
      const gcats = new Set(g.categories);
      if (!f.categories.every((c) => gcats.has(c))) return false;
    }
    // Mason
    if (f.masonFilter === "played" && !g.playedWithMason) return false;
    if (f.masonFilter === "notPlayed" && g.playedWithMason) return false;
    return true;
  });
}

export function pickRandom(games: Game[]): Game | null {
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}

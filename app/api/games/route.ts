import { NextResponse } from "next/server";
import { readGames, type Game } from "@/lib/sheets";
import fallback from "@/data/games.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/games — returns all games from the sheet (or bundled fallback). */
export async function GET() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.SPREADSHEET_ID) {
    // No credentials — serve the bundled snapshot so the app still works.
    return NextResponse.json({
      source: "fallback",
      games: normaliseFallback(fallback as any[]),
    });
  }
  try {
    const games = await readGames();
    return NextResponse.json({ source: "sheet", games });
  } catch (e: any) {
    return NextResponse.json(
      { source: "fallback", error: e.message, games: normaliseFallback(fallback as any[]) },
      { status: 200 }
    );
  }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function normaliseFallback(arr: any[]): Game[] {
  return arr.map((g) => ({
    id: g.id,
    row: g.row ?? 0,
    name: g.name,
    ratings: g.ratings ?? {
      personal: g.rating ?? null,
      easeOfLearning: null,
      easeOfPlaying: null,
      speed: null,
      repeatability: null,
      originality: null,
    },
    total: g.total ?? null,
    rank: g.rank ?? null,
    lastPlayedDate: g.lastPlayedDate ?? null,
    daysSince: daysSince(g.lastPlayedDate ?? null),
    minPlayers: g.minPlayers ?? null,
    maxPlayers: g.maxPlayers ?? null,
    recommended: g.recommended ?? null,
    bestPrice: g.bestPrice ?? null,
    categories: g.categories ?? [],
    playedWithMason: !!g.playedWithMason,
  }));
}

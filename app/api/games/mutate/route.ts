import { NextRequest, NextResponse } from "next/server";
import { addGame, updateGame, markPlayed, type GameInput } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function requireCreds() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.SPREADSHEET_ID) {
    return "Spreadsheet is not configured on the server (missing GOOGLE_SERVICE_ACCOUNT_KEY / SPREADSHEET_ID). Edits are disabled until it's set up.";
  }
  return null;
}

function parseInput(body: any): GameInput {
  const r = body.ratings || {};
  const num = (v: any) =>
    v === "" || v === null || v === undefined ? null : Number(v);
  return {
    name: (body.name || "").toString().trim(),
    ratings: {
      personal: num(r.personal),
      easeOfLearning: num(r.easeOfLearning),
      easeOfPlaying: num(r.easeOfPlaying),
      speed: num(r.speed),
      repeatability: num(r.repeatability),
      originality: num(r.originality),
    },
    lastPlayedDate: body.lastPlayedDate || null,
    minPlayers: num(body.minPlayers),
    maxPlayers: num(body.maxPlayers),
    recommended: num(body.recommended),
    bestPrice: body.bestPrice || null,
    categories: Array.isArray(body.categories) ? body.categories : [],
    playedWithMason: !!body.playedWithMason,
  };
}

/** POST /api/games/mutate — add or update a game, or mark it played. */
export async function POST(req: NextRequest) {
  const err = requireCreds();
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 503 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  try {
    if (action === "add") {
      const input = parseInput(body);
      if (!input.name)
        return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
      const row = await addGame(input);
      return NextResponse.json({ ok: true, row });
    }
    if (action === "update") {
      const row = Number(body.row);
      if (!row) return NextResponse.json({ ok: false, error: "row is required" }, { status: 400 });
      const input = parseInput(body);
      await updateGame(row, input);
      return NextResponse.json({ ok: true, row });
    }
    if (action === "markPlayed") {
      const row = Number(body.row);
      if (!row) return NextResponse.json({ ok: false, error: "row is required" }, { status: 400 });
      await markPlayed(row);
      return NextResponse.json({ ok: true, row });
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

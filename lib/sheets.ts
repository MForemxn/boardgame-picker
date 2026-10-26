import { google, sheets_v4 } from "googleapis";

/**
 * Google Sheets backend. The spreadsheet is the source of truth.
 *
 * Auth: a Google service account whose key JSON is stored in the
 * GOOGLE_SERVICE_ACCOUNT_KEY env var (base64 or raw JSON). The sheet must be
 * shared with the service account's client_email as an Editor.
 *
 * Sheet layout (data starts at row DATA_START_ROW; header at HEADER_ROW):
 *   A name | B personal | C easeOfLearning | D easeOfPlaying | E speed
 *   F repeatability | G originality | H Total(formula) | I Rank(formula)
 *   J Last Played (=DATEDIF("m/d/yyyy", today(), "D")) | K min | L max
 *   M recommended | N bestPrice | O..X category booleans
 *   Y Played With Mason (TRUE/FALSE)  <- added by this app
 */

export const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "";
export const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";
export const HEADER_ROW = 6;
export const DATA_START_ROW = 7;

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

// Column letters (1-indexed letters) for category booleans O..X
const CAT_COLS = ["O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"];
const MASON_COL = "Y";

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
  row: number; // sheet row number (source of truth key)
  name: string;
  ratings: Ratings;
  total: number | null;
  rank: number | null;
  lastPlayedDate: string | null; // ISO yyyy-mm-dd
  daysSince: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  recommended: number | null;
  bestPrice: string | null;
  categories: string[];
  playedWithMason: boolean;
}

export interface GameInput {
  name: string;
  ratings: Ratings;
  lastPlayedDate: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  recommended: number | null;
  bestPrice: string | null;
  categories: string[];
  playedWithMason: boolean;
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  let json: any;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    json = JSON.parse(trimmed);
  } else {
    json = JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
  }
  // Private keys often arrive with escaped newlines
  if (typeof json.private_key === "string") {
    json.private_key = json.private_key.replace(/\\n/g, "\n");
  }
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function client(): Promise<sheets_v4.Sheets> {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth: await auth.getClient() as any });
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDateFromDatedif(formula: any): string | null {
  if (typeof formula !== "string") return null;
  const m = formula.match(/DATEDIF\("([0-9/]+)"/i);
  if (!m) return null;
  const parts = m[1].split("/");
  if (parts.length !== 3) return null;
  const [mm, dd, yy] = parts.map((p) => parseInt(p, 10));
  if (!mm || !dd || !yy) return null;
  return `${yy.toString().padStart(4, "0")}-${mm
    .toString()
    .padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
}

function isoToUsDate(iso: string): string {
  // yyyy-mm-dd -> m/d/yyyy  (what the DATEDIF formula expects)
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return `${m}/${d}/${y}`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso + "T00:00:00");
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** Read all games. Reads both formatted values and formulas (for dates). */
export async function readGames(): Promise<Game[]> {
  const sheets = await client();
  const range = `${SHEET_NAME}!A${DATA_START_ROW}:Y1003`;
  // Formatted values for most cells
  const valsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  // Formulas, to extract the DATEDIF start date in column J
  const formResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "FORMULA",
  });
  const vals = valsResp.data.values || [];
  const forms = formResp.data.values || [];

  const games: Game[] = [];
  for (let i = 0; i < vals.length; i++) {
    const r = vals[i] || [];
    const fr = forms[i] || [];
    const name = (r[0] ?? "").toString().trim();
    if (!name) continue;
    const row = DATA_START_ROW + i;
    const cats: string[] = [];
    CATEGORIES.forEach((c, idx) => {
      const v = r[14 + idx];
      if (v === true || v === "TRUE" || v === 1) cats.push(c);
    });
    const lastPlayedDate = parseDateFromDatedif(fr[9]);
    const priceNum = toNum(r[13]);
    const masonVal = r[24];
    games.push({
      id: slug(name),
      row,
      name,
      ratings: {
        personal: toNum(r[1]),
        easeOfLearning: toNum(r[2]),
        easeOfPlaying: toNum(r[3]),
        speed: toNum(r[4]),
        repeatability: toNum(r[5]),
        originality: toNum(r[6]),
      },
      total: toNum(r[7]),
      rank: toNum(r[8]),
      lastPlayedDate,
      daysSince: daysSince(lastPlayedDate),
      minPlayers: toNum(r[10]),
      maxPlayers: toNum(r[11]),
      recommended: toNum(r[12]),
      bestPrice: priceNum != null ? `$${priceNum.toFixed(2)}` : null,
      categories: cats,
      playedWithMason:
        masonVal === true || masonVal === "TRUE" || masonVal === 1,
    });
  }
  return games;
}

function priceToNumber(p: string | null): number | "" {
  if (!p) return "";
  const n = Number(p.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : "";
}

/** Build the A..Y row array for a game input. */
function buildRow(input: GameInput): any[] {
  const catBooleans = CATEGORIES.map((c) => input.categories.includes(c));
  const lastPlayed = input.lastPlayedDate
    ? `=DATEDIF("${isoToUsDate(input.lastPlayedDate)}",today(),"D")`
    : "";
  return [
    input.name, // A
    input.ratings.personal ?? "", // B
    input.ratings.easeOfLearning ?? "", // C
    input.ratings.easeOfPlaying ?? "", // D
    input.ratings.speed ?? "", // E
    input.ratings.repeatability ?? "", // F
    input.ratings.originality ?? "", // G
    "", // H Total — recalculated by sheet formula below
    "", // I Rank — recalculated by sheet formula below
    lastPlayed, // J
    input.minPlayers ?? "", // K
    input.maxPlayers ?? "", // L
    input.recommended ?? "", // M
    priceToNumber(input.bestPrice), // N
    ...catBooleans, // O..X
    input.playedWithMason, // Y
  ];
}

/** Update an existing game at the given row. */
export async function updateGame(row: number, input: GameInput): Promise<void> {
  const sheets = await client();
  const rowValues = buildRow(input);
  // Write A..G (name + 6 ratings), J (last played), K..Y. Leave H & I to formulas.
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${SHEET_NAME}!A${row}:G${row}`, values: [rowValues.slice(0, 7)] },
        { range: `${SHEET_NAME}!J${row}:J${row}`, values: [[rowValues[9]]] },
        { range: `${SHEET_NAME}!K${row}:Y${row}`, values: [rowValues.slice(10)] },
      ],
    },
  });
  await syncFormulas(sheets, row);
  await syncMasonHighlight(sheets, row, input.playedWithMason);
}

/** Append a new game at the first empty row after existing data. */
export async function addGame(input: GameInput): Promise<number> {
  const sheets = await client();
  // Find next empty row by reading column A
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${DATA_START_ROW}:A1003`,
  });
  const used = (colA.data.values || []).filter((r) => (r[0] ?? "").toString().trim()).length;
  const row = DATA_START_ROW + used;
  const rowValues = buildRow(input);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${SHEET_NAME}!A${row}:G${row}`, values: [rowValues.slice(0, 7)] },
        { range: `${SHEET_NAME}!J${row}:J${row}`, values: [[rowValues[9]]] },
        { range: `${SHEET_NAME}!K${row}:Y${row}`, values: [rowValues.slice(10)] },
      ],
    },
  });
  await syncFormulas(sheets, row);
  await syncMasonHighlight(sheets, row, input.playedWithMason);
  return row;
}

/** Mark a game as just played today (updates J date + daysSince reset). */
export async function markPlayed(row: number): Promise<void> {
  const sheets = await client();
  const now = new Date();
  const us = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!J${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[`=DATEDIF("${us}",today(),"D")`]] },
  });
}

/** Ensure H (Total) and I (Rank) formulas exist on a row. */
async function syncFormulas(sheets: sheets_v4.Sheets, row: number): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!H${row}:I${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[`=((5*B${row}+SUM(C${row}:G${row})))`, `=rank(H${row},H$7:H$997)`]],
    },
  });
}

/** Keep the light-blue name highlight in sync with the Mason flag. */
async function syncMasonHighlight(
  sheets: sheets_v4.Sheets,
  row: number,
  played: boolean
): Promise<void> {
  const sheetId = await getSheetId(sheets);
  const blue = { red: 0.788, green: 0.855, blue: 0.973 }; // #C9DAF8
  const white = { red: 1, green: 1, blue: 1 };
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: row - 1,
              endRowIndex: row,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: played ? blue : white,
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  });
}

let _sheetIdCache: number | null = null;
async function getSheetId(sheets: sheets_v4.Sheets): Promise<number> {
  if (_sheetIdCache != null) return _sheetIdCache;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find(
    (s) => s.properties?.title === SHEET_NAME
  );
  _sheetIdCache = sheet?.properties?.sheetId ?? 0;
  return _sheetIdCache;
}

export { slug, daysSince };

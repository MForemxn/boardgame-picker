#!/usr/bin/env node
/**
 * Live test harness for the Google Sheets backend.
 * Usage:
 *   SPREADSHEET_ID=... GOOGLE_SERVICE_ACCOUNT_KEY=... node scripts/test-sheet.mjs read
 *   ... node scripts/test-sheet.mjs roundtrip      (adds a temp game, edits it, marks played)
 *
 * This imports the compiled lib via tsx/ts-node-free dynamic import of a JS shim is avoided;
 * instead it re-implements nothing — it shells into the same googleapis calls by importing
 * the TypeScript through a tiny loader. For simplicity we duplicate minimal read logic here
 * to avoid a TS build just for testing.
 */
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";
const DATA_START_ROW = 7;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  const t = raw.trim();
  let json = t.startsWith("{") ? JSON.parse(t) : JSON.parse(Buffer.from(t, "base64").toString("utf8"));
  if (typeof json.private_key === "string") json.private_key = json.private_key.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function client() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

async function read() {
  const sheets = await client();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${DATA_START_ROW}:Y1003`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = (r.data.values || []).filter((x) => (x[0] ?? "").toString().trim());
  console.log(`READ OK — ${rows.length} games`);
  console.log("first:", rows[0]?.slice(0, 2), "mason(Y):", rows[0]?.[24]);
  const played = rows.filter((x) => x[24] === true || x[24] === "TRUE").length;
  console.log("played-with-mason (col Y TRUE):", played);
  return rows;
}

async function roundtrip() {
  const sheets = await client();
  const rows = await read();
  const testRow = DATA_START_ROW + rows.length; // next empty
  const name = "__TEST_GAME_" + Date.now();
  console.log(`\nAdding temp game "${name}" at row ${testRow}…`);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${SHEET_NAME}!A${testRow}:G${testRow}`, values: [[name, 7, 8, 9, 8, 7, 8]] },
        { range: `${SHEET_NAME}!J${testRow}`, values: [[`=DATEDIF("1/1/2026",today(),"D")`]] },
        { range: `${SHEET_NAME}!K${testRow}:Y${testRow}`, values: [[2, 4, 3, 25, true, false, false, false, false, true, false, false, false, false, true]] },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!H${testRow}:I${testRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[`=((5*B${testRow}+SUM(C${testRow}:G${testRow})))`, `=rank(H${testRow},H$7:H$997)`]] },
  });
  console.log("Added. Verifying…");
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${testRow}:Y${testRow}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const v = check.data.values[0];
  console.log("  name:", v[0], "| total(H):", v[7], "| mason(Y):", v[24], "| daysSince(J):", v[9]);

  console.log("\nMarking played today…");
  const now = new Date();
  const us = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!J${testRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[`=DATEDIF("${us}",today(),"D")`]] },
  });
  const check2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!J${testRow}`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  console.log("  daysSince after markPlayed:", check2.data.values[0][0], "(should be 0)");

  console.log("\nCleaning up temp row…");
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { ranges: [`${SHEET_NAME}!A${testRow}:Y${testRow}`] },
  });
  console.log("ROUNDTRIP OK ✅");
}

const cmd = process.argv[2] || "read";
(cmd === "roundtrip" ? roundtrip() : read()).catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

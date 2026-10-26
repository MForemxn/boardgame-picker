#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const outDir = process.argv[2];
if (!SPREADSHEET_ID || !outDir) {
  console.error("usage: SPREADSHEET_ID=... GOOGLE_SERVICE_ACCOUNT_KEY=... node backup-sheet.mjs OUTDIR");
  process.exit(1);
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const t = raw.trim();
  let json = t.startsWith("{") ? JSON.parse(t) : JSON.parse(Buffer.from(t, "base64").toString("utf8"));
  if (typeof json.private_key === "string") json.private_key = json.private_key.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function toCsv(rows) {
  return (rows || [])
    .map((r) =>
      r
        .map((c) => {
          const s = c == null ? "" : String(c);
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\n");
}

fs.mkdirSync(outDir, { recursive: true });
const auth = getAuth();
const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const info = {
  spreadsheetId: SPREADSHEET_ID,
  title: meta.data.properties?.title,
  locale: meta.data.properties?.locale,
  timeZone: meta.data.properties?.timeZone,
  backedUpAt: new Date().toISOString(),
  sheets: (meta.data.sheets || []).map((s) => ({
    title: s.properties?.title,
    sheetId: s.properties?.sheetId,
    rowCount: s.properties?.gridProperties?.rowCount,
    columnCount: s.properties?.gridProperties?.columnCount,
  })),
};
fs.writeFileSync(path.join(outDir, "metadata.json"), JSON.stringify(info, null, 2));
for (const s of info.sheets) {
  const title = s.title;
  const range = `'${title.replace(/'/g, "''")}'`;
  const vals = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const forms = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "FORMULA",
  });
  const safe = title.replace(/[^\w.-]+/g, "_");
  fs.writeFileSync(path.join(outDir, `${safe}.values.json`), JSON.stringify(vals.data.values || [], null, 2));
  fs.writeFileSync(path.join(outDir, `${safe}.formulas.json`), JSON.stringify(forms.data.values || [], null, 2));
  fs.writeFileSync(path.join(outDir, `${safe}.values.csv`), toCsv(vals.data.values || []));
  fs.writeFileSync(path.join(outDir, `${safe}.formulas.csv`), toCsv(forms.data.values || []));
  console.log(title, "rows", (vals.data.values || []).length);
}
console.log("BACKUP_OK", outDir);

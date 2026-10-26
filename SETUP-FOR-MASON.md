# Board Game Picker — Google setup (for Mason)

Hey Mason — Adam's board-game picker app needs to read/write his Google Sheet.
Could you set up a Google **service account** and hand the key + sheet ID back?
~5 minutes. Everything else (the app, API routes, Vercel deploy) is already built.

The sheet:
https://docs.google.com/spreadsheets/d/10kkUae8Dm8SHQGNFViDXaguv1y-dv2wX-4UvYyzWPEI/edit

## 1. Create a Google Cloud project
https://console.cloud.google.com/projectcreate
Name it `boardgame-picker` → Create → select it (top-left dropdown).

## 2. Enable the Sheets API
https://console.cloud.google.com/apis/library/sheets.googleapis.com
(with the project selected) → Enable.

## 3. Create the service account + JSON key
https://console.cloud.google.com/iam-admin/serviceaccounts/create
- Name: `boardgame-app` → Create and Continue
- Skip the optional "grant access"/"users" steps → Done
- Click the account → **Keys** tab → Add Key → Create new key → **JSON** → Create
- A `.json` file downloads. That's the key.

## 4. Share the sheet with the service account
- Open the JSON, copy the `"client_email"` value
  (e.g. `boardgame-app@boardgame-picker-xxxxx.iam.gserviceaccount.com`)
- In the sheet → Share → paste that email → **Editor** → Send.

## 5. Deploy to Vercel
Project folder is at: `~/share/Adam/Projects/boardgame-picker`
(README.md has the full git + Vercel import steps.)

Set these Vercel **Environment Variables** (Project → Settings → Environment Variables):

| Name | Value |
|------|-------|
| `SPREADSHEET_ID` | `10kkUae8Dm8SHQGNFViDXaguv1y-dv2wX-4UvYyzWPEI` |
| `SHEET_NAME` | `Sheet1` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | the entire contents of the downloaded JSON file (paste it raw, or base64-encode it — the app accepts either) |

Redeploy after setting them. The app reads/writes the sheet live; without the key it
falls back to a read-only bundled snapshot.

## Want Adam's agent to verify it first?
If you drop the JSON key somewhere on the Bazzite box (or paste its path back to Adam),
the agent will run a live read + write round-trip against a **copy** of the sheet to prove
it works before it touches the real data. Test script: `scripts/test-sheet.mjs`.

Thanks!
— sent on Adam's behalf

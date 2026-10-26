# 🎲 Board Game Picker

A Next.js app that randomly picks a board game from Adam's collection, with filters for:

- **Number of players** — only shows games that support that count
- **Style** — Board, Card, Party, Puzzle, Deception, Strategy, Skill, Knowledge, Luck, Cooperative/Teams (game must match *all* selected)
- **Played with Mason** — Any / Already played / Not yet

Three tabs: **Pick a game**, **Browse** (searchable, sortable list), and **Add a game**.

The collection (171 games) lives in `data/games.json`, generated from Adam's Google Sheet. The light-blue–highlighted names in the sheet were mapped to `playedWithMason: true`.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
```

## Deploy to Vercel (for Mason)

1. Create a new GitHub repo and push this folder:
   ```bash
   cd boardgame-picker
   git init
   git add -A
   git commit -m "Board game picker"
   git branch -M main
   git remote add origin git@github.com:<your-account>/boardgame-picker.git
   git push -u origin main
   ```
2. In Vercel → **Add New → Project → Import** the repo.
3. Framework preset auto-detects **Next.js**. No env vars needed. Click **Deploy**.

That's it — it's a static-friendly Next.js app with no database or secrets.

## Adding games

Use the **Add a game** tab in the app: fill in the fields, hit **Copy JSON**, and
paste the generated object into the array in `data/games.json`. Commit + push and
Vercel redeploys automatically. (Storage is a JSON file in the repo, so new games
persist via a commit rather than a live database — per Adam's choice.)

## Data schema (`data/games.json`)

```jsonc
{
  "id": "carcassone",            // slug, must be unique
  "name": "Carcassone",
  "rating": 10,                  // personal rating 0–10 | null
  "total": 98.5,                 // sheet "Total" score | null
  "rank": 1,                     // sheet rank | null
  "minPlayers": 2,
  "maxPlayers": 6,
  "recommended": 3,
  "bestPrice": "$54.95",         // string | null
  "categories": ["Board", "Puzzle", "Strategy", "Luck"],
  "playedWithMason": false
}
```

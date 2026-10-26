"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  GAMES,
  filterGames,
  pickRandom,
  type Filters,
  type Game,
} from "@/lib/games";

type Tab = "pick" | "browse" | "add";

export default function Home() {
  const [tab, setTab] = useState<Tab>("pick");

  return (
    <div className="container">
      <div className="header">
        <h1>🎲 Board Game Picker</h1>
        <p>{GAMES.length} games in the collection</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === "pick" ? "active" : ""}`}
          onClick={() => setTab("pick")}
        >
          Pick a game
        </button>
        <button
          className={`tab ${tab === "browse" ? "active" : ""}`}
          onClick={() => setTab("browse")}
        >
          Browse
        </button>
        <button
          className={`tab ${tab === "add" ? "active" : ""}`}
          onClick={() => setTab("add")}
        >
          Add a game
        </button>
      </div>

      {tab === "pick" && <PickTab />}
      {tab === "browse" && <BrowseTab />}
      {tab === "add" && <AddTab />}
    </div>
  );
}

/* ---------------- PICK ---------------- */

function PickTab() {
  const [players, setPlayers] = useState<number | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [mason, setMason] = useState<Filters["masonFilter"]>("any");
  const [result, setResult] = useState<Game | null>(null);
  const [picked, setPicked] = useState(false);

  const filters: Filters = {
    players,
    categories: cats,
    masonFilter: mason,
    usePreferredCount: false,
  };

  const matches = useMemo(() => filterGames(GAMES, filters), [
    players,
    cats,
    mason,
  ]);

  function toggleCat(c: string) {
    setCats((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );
  }

  function roll() {
    setResult(pickRandom(matches));
    setPicked(true);
  }

  return (
    <>
      <div className="panel">
        <h2>Filters</h2>

        <div className="field">
          <label>
            Number of players{" "}
            <span className="hint">(leave blank for any)</span>
          </label>
          <div className="players-row">
            <input
              type="number"
              min={1}
              max={30}
              placeholder="any"
              value={players ?? ""}
              onChange={(e) =>
                setPlayers(
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
            <span className="hint">
              shows games that support this count
            </span>
          </div>
        </div>

        <div className="field">
          <label>
            Style <span className="hint">(game must match all selected)</span>
          </label>
          <div className="row">
            {CATEGORIES.map((c) => (
              <span
                key={c}
                className={`chip ${cats.includes(c) ? "on" : ""}`}
                onClick={() => toggleCat(c)}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Played with Mason?</label>
          <div className="seg">
            <button
              className={mason === "any" ? "on" : ""}
              onClick={() => setMason("any")}
            >
              Any
            </button>
            <button
              className={mason === "played" ? "on" : ""}
              onClick={() => setMason("played")}
            >
              Already played
            </button>
            <button
              className={mason === "notPlayed" ? "on" : ""}
              onClick={() => setMason("notPlayed")}
            >
              Not yet
            </button>
          </div>
        </div>

        <button className="btn" onClick={roll} disabled={matches.length === 0}>
          {matches.length === 0 ? "No games match" : "🎲 Pick one for me"}
        </button>
        <p className="count">{matches.length} games match your filters</p>
      </div>

      {picked && (
        <div className="panel">
          {result ? (
            <div className="result" key={result.id + Math.random()}>
              <div className="hint">You should play…</div>
              <div className="name">{result.name}</div>
              <div className="meta">
                {playerLabel(result)}
                {result.recommended
                  ? ` · best with ${result.recommended}`
                  : ""}
              </div>
              <div className="badges">
                {result.categories.map((c) => (
                  <span className="badge" key={c}>
                    {c}
                  </span>
                ))}
                {result.playedWithMason && (
                  <span className="badge mason">✓ played with Mason</span>
                )}
              </div>
              {result.rating != null && (
                <div className="meta">⭐ {result.rating}/10 personal rating</div>
              )}
              <div style={{ marginTop: 18 }}>
                <button className="btn secondary small" onClick={roll}>
                  🎲 Pick again
                </button>
              </div>
            </div>
          ) : (
            <div className="empty">
              No games match those filters — try loosening them.
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- BROWSE ---------------- */

function BrowseTab() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rank" | "name" | "rating">("rank");

  const list = useMemo(() => {
    let l = GAMES.filter((g) =>
      g.name.toLowerCase().includes(q.toLowerCase())
    );
    l = [...l].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
    return l;
  }, [q, sort]);

  return (
    <div className="panel">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search games…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="field">
        <div className="seg">
          <button
            className={sort === "rank" ? "on" : ""}
            onClick={() => setSort("rank")}
          >
            By rank
          </button>
          <button
            className={sort === "name" ? "on" : ""}
            onClick={() => setSort("name")}
          >
            A–Z
          </button>
          <button
            className={sort === "rating" ? "on" : ""}
            onClick={() => setSort("rating")}
          >
            By rating
          </button>
        </div>
      </div>
      <p className="count">{list.length} games</p>
      <div className="game-list">
        {list.map((g) => (
          <div
            key={g.id}
            className={`game-card ${g.playedWithMason ? "played" : ""}`}
          >
            <div className="gname">{g.name}</div>
            <div className="gmeta">
              {playerLabel(g)}
              {g.rating != null ? ` · ⭐ ${g.rating}` : ""}
            </div>
            <div className="gmeta">{g.categories.join(", ")}</div>
            {g.playedWithMason && (
              <div className="gmeta" style={{ color: "var(--blue)" }}>
                ✓ played with Mason
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- ADD ---------------- */

function AddTab() {
  const [name, setName] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [rec, setRec] = useState("");
  const [rating, setRating] = useState("");
  const [price, setPrice] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [played, setPlayed] = useState(false);
  const [copied, setCopied] = useState(false);

  function toggleCat(c: string) {
    setCats((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );
  }

  const obj = {
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name: name.trim(),
    rating: rating === "" ? null : Number(rating),
    total: null,
    rank: null,
    minPlayers: min === "" ? null : Number(min),
    maxPlayers: max === "" ? null : Number(max),
    recommended: rec === "" ? null : Number(rec),
    bestPrice: price.trim() || null,
    categories: cats,
    playedWithMason: played,
  };

  const snippet = JSON.stringify(obj, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="panel">
      <h2>Add a game</h2>
      <p className="hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Fill this in, then copy the generated entry and paste it into{" "}
        <code>data/games.json</code> (or hand it to Mason to commit). The site
        updates on the next deploy.
      </p>

      <div className="add-grid">
        <div className="field full">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wingspan"
          />
        </div>
        <div className="field">
          <label>Min players</label>
          <input
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Max players</label>
          <input
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Recommended players</label>
          <input
            type="number"
            value={rec}
            onChange={(e) => setRec(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Personal rating (0–10)</label>
          <input
            type="number"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </div>
        <div className="field full">
          <label>Best price (optional)</label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$0.00"
          />
        </div>
        <div className="field full">
          <label>Style / categories</label>
          <div className="row">
            {CATEGORIES.map((c) => (
              <span
                key={c}
                className={`chip ${cats.includes(c) ? "on" : ""}`}
                onClick={() => toggleCat(c)}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="field full">
          <label>
            <input
              type="checkbox"
              checked={played}
              onChange={(e) => setPlayed(e.target.checked)}
              style={{ width: "auto", marginRight: 8 }}
            />
            Already played with Mason
          </label>
        </div>
      </div>

      {name.trim() && (
        <>
          <label style={{ fontWeight: 600, display: "block", margin: "8px 0" }}>
            Generated entry
          </label>
          <div className="codebox">{snippet}</div>
          <div style={{ marginTop: 12 }}>
            <button className="btn secondary small" onClick={copy}>
              {copied ? "✓ Copied!" : "Copy JSON"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function playerLabel(g: Game): string {
  if (g.minPlayers == null && g.maxPlayers == null) return "players: n/a";
  if (g.minPlayers === g.maxPlayers) return `${g.minPlayers} players`;
  return `${g.minPlayers ?? "?"}–${g.maxPlayers ?? "?"} players`;
}

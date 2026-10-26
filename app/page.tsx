"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  RATING_KEYS,
  RATING_LABELS,
  daysSinceLabel,
  filterGames,
  pickRandom,
  type Filters,
  type Game,
  type RatingKey,
  type Ratings,
} from "@/lib/games";

type Tab = "pick" | "browse" | "add";

export default function Home() {
  const [tab, setTab] = useState<Tab>("pick");
  const [games, setGames] = useState<Game[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Game | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      const data = await res.json();
      setGames(data.games || []);
      setSource(data.source || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const writable = source === "sheet";

  return (
    <div className="container">
      <div className="header">
        <h1>🎲 Board Game Picker</h1>
        <p>
          {loading ? "Loading…" : `${games.length} games in the collection`}
          {!loading && source === "fallback" && (
            <span className="hint"> · read-only snapshot (sheet not connected)</span>
          )}
          {!loading && writable && <span className="hint"> · live from spreadsheet</span>}
        </p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "pick" ? "active" : ""}`} onClick={() => setTab("pick")}>
          Pick a game
        </button>
        <button className={`tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
          Browse
        </button>
        <button
          className={`tab ${tab === "add" ? "active" : ""}`}
          onClick={() => {
            setEditing(null);
            setTab("add");
          }}
        >
          Add a game
        </button>
      </div>

      {tab === "pick" && <PickTab games={games} />}
      {tab === "browse" && (
        <BrowseTab
          games={games}
          writable={writable}
          onEdit={(g) => {
            setEditing(g);
            setTab("add");
          }}
          onChanged={load}
        />
      )}
      {tab === "add" && (
        <AddEditTab
          editing={editing}
          writable={writable}
          onDone={async () => {
            await load();
            setEditing(null);
            setTab("browse");
          }}
        />
      )}
    </div>
  );
}

/* ---------------- PICK ---------------- */

function PickTab({ games }: { games: Game[] }) {
  const [players, setPlayers] = useState<number | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [mason, setMason] = useState<Filters["masonFilter"]>("any");
  const [result, setResult] = useState<Game | null>(null);
  const [picked, setPicked] = useState(false);
  const [nonce, setNonce] = useState(0);

  const filters: Filters = { players, categories: cats, masonFilter: mason };
  const matches = useMemo(() => filterGames(games, filters), [games, players, cats, mason]);

  function toggleCat(c: string) {
    setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }
  function roll() {
    setResult(pickRandom(matches));
    setPicked(true);
    setNonce((n) => n + 1);
  }

  return (
    <>
      <div className="panel">
        <h2>Filters</h2>
        <div className="field">
          <label>
            Number of players <span className="hint">(leave blank for any)</span>
          </label>
          <div className="players-row">
            <input
              type="number"
              min={1}
              max={30}
              placeholder="any"
              value={players ?? ""}
              onChange={(e) => setPlayers(e.target.value === "" ? null : Number(e.target.value))}
            />
            <span className="hint">shows games that support this count</span>
          </div>
        </div>
        <div className="field">
          <label>
            Style <span className="hint">(game must match all selected)</span>
          </label>
          <div className="row">
            {CATEGORIES.map((c) => (
              <span key={c} className={`chip ${cats.includes(c) ? "on" : ""}`} onClick={() => toggleCat(c)}>
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Played with Mason?</label>
          <div className="seg">
            <button className={mason === "any" ? "on" : ""} onClick={() => setMason("any")}>Any</button>
            <button className={mason === "played" ? "on" : ""} onClick={() => setMason("played")}>Already played</button>
            <button className={mason === "notPlayed" ? "on" : ""} onClick={() => setMason("notPlayed")}>Not yet</button>
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
            <div className="result" key={nonce}>
              <div className="hint">You should play…</div>
              <div className="name">{result.name}</div>
              <div className="meta">
                {playerLabel(result)}
                {result.recommended ? ` · best with ${result.recommended}` : ""}
              </div>
              <div className="meta">⏱ last played {daysSinceLabel(result)}</div>
              <div className="badges">
                {result.categories.map((c) => (
                  <span className="badge" key={c}>{c}</span>
                ))}
                {result.playedWithMason && <span className="badge mason">✓ played with Mason</span>}
              </div>
              {result.ratings.personal != null && (
                <div className="meta">⭐ {result.ratings.personal}/10 personal rating</div>
              )}
              <div style={{ marginTop: 18 }}>
                <button className="btn secondary small" onClick={roll}>🎲 Pick again</button>
              </div>
            </div>
          ) : (
            <div className="empty">No games match those filters — try loosening them.</div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- BROWSE ---------------- */

function BrowseTab({
  games,
  writable,
  onEdit,
  onChanged,
}: {
  games: Game[];
  writable: boolean;
  onEdit: (g: Game) => void;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rank" | "name" | "rating" | "recent">("rank");
  const [busyRow, setBusyRow] = useState<number | null>(null);

  const list = useMemo(() => {
    let l = games.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
    l = [...l].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return (b.ratings.personal ?? 0) - (a.ratings.personal ?? 0);
      if (sort === "recent") return (a.daysSince ?? 1e9) - (b.daysSince ?? 1e9);
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
    return l;
  }, [games, q, sort]);

  async function markPlayed(g: Game) {
    setBusyRow(g.row);
    try {
      await fetch("/api/games/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markPlayed", row: g.row }),
      });
      onChanged();
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <div className="panel">
      <div className="search-bar">
        <input type="text" placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="field">
        <div className="seg">
          <button className={sort === "rank" ? "on" : ""} onClick={() => setSort("rank")}>By rank</button>
          <button className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>A–Z</button>
          <button className={sort === "rating" ? "on" : ""} onClick={() => setSort("rating")}>By rating</button>
          <button className={sort === "recent" ? "on" : ""} onClick={() => setSort("recent")}>Recently played</button>
        </div>
      </div>
      <p className="count">{list.length} games</p>
      <div className="game-list">
        {list.map((g) => (
          <div key={g.id} className={`game-card ${g.playedWithMason ? "played" : ""}`}>
            <div className="gname">{g.name}</div>
            <div className="gmeta">
              {playerLabel(g)}
              {g.ratings.personal != null ? ` · ⭐ ${g.ratings.personal}` : ""}
            </div>
            <div className="gmeta">{g.categories.join(", ")}</div>
            <div className="gmeta">⏱ {daysSinceLabel(g)}</div>
            {g.playedWithMason && (
              <div className="gmeta" style={{ color: "var(--blue)" }}>✓ played with Mason</div>
            )}
            {writable && (
              <div className="card-actions">
                <button className="btn secondary small" onClick={() => onEdit(g)}>Edit</button>
                <button
                  className="btn secondary small"
                  disabled={busyRow === g.row}
                  onClick={() => markPlayed(g)}
                >
                  {busyRow === g.row ? "…" : "Played today"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- ADD / EDIT ---------------- */

const emptyRatings: Ratings = {
  personal: null,
  easeOfLearning: null,
  easeOfPlaying: null,
  speed: null,
  repeatability: null,
  originality: null,
};

function AddEditTab({
  editing,
  writable,
  onDone,
}: {
  editing: Game | null;
  writable: boolean;
  onDone: () => void;
}) {
  const isEdit = !!editing;
  const [name, setName] = useState(editing?.name ?? "");
  const [ratings, setRatings] = useState<Ratings>(editing?.ratings ?? emptyRatings);
  const [min, setMin] = useState(editing?.minPlayers?.toString() ?? "");
  const [max, setMax] = useState(editing?.maxPlayers?.toString() ?? "");
  const [rec, setRec] = useState(editing?.recommended?.toString() ?? "");
  const [price, setPrice] = useState(editing?.bestPrice ?? "");
  const [cats, setCats] = useState<string[]>(editing?.categories ?? []);
  const [played, setPlayed] = useState(editing?.playedWithMason ?? false);
  const [lastPlayed, setLastPlayed] = useState(editing?.lastPlayedDate ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleCat(c: string) {
    setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }
  function setRating(k: RatingKey, v: string) {
    setRatings((r) => ({ ...r, [k]: v === "" ? null : Number(v) }));
  }

  async function save() {
    if (!name.trim()) {
      setMsg("Name is required.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const payload = {
      action: isEdit ? "update" : "add",
      row: editing?.row,
      name: name.trim(),
      ratings,
      minPlayers: min === "" ? null : Number(min),
      maxPlayers: max === "" ? null : Number(max),
      recommended: rec === "" ? null : Number(rec),
      bestPrice: price.trim() || null,
      categories: cats,
      playedWithMason: played,
      lastPlayedDate: lastPlayed || null,
    };
    try {
      const res = await fetch("/api/games/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        onDone();
      } else {
        setMsg(data.error || "Save failed.");
      }
    } catch (e: any) {
      setMsg(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!writable) {
    return (
      <div className="panel">
        <h2>{isEdit ? "Edit game" : "Add a game"}</h2>
        <div className="empty">
          The spreadsheet isn&apos;t connected on the server, so adding and editing are
          disabled. Set the <code>GOOGLE_SERVICE_ACCOUNT_KEY</code> and{" "}
          <code>SPREADSHEET_ID</code> environment variables in Vercel to enable live edits.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>{isEdit ? `Edit: ${editing!.name}` : "Add a game"}</h2>
      <p className="hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Changes write straight to the Google Sheet (the source of truth).
      </p>

      <div className="add-grid">
        <div className="field full">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wingspan" />
        </div>

        <div className="field">
          <label>Min players</label>
          <input type="number" value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div className="field">
          <label>Max players</label>
          <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="field">
          <label>Recommended players</label>
          <input type="number" value={rec} onChange={(e) => setRec(e.target.value)} />
        </div>
        <div className="field">
          <label>Best price</label>
          <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$0.00" />
        </div>

        <div className="field full">
          <label>Ratings <span className="hint">(0–10 each)</span></label>
          <div className="ratings-grid">
            {RATING_KEYS.map((k) => (
              <div className="rating-item" key={k}>
                <span>{RATING_LABELS[k]}</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={ratings[k] ?? ""}
                  onChange={(e) => setRating(k, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="field full">
          <label>Style / categories</label>
          <div className="row">
            {CATEGORIES.map((c) => (
              <span key={c} className={`chip ${cats.includes(c) ? "on" : ""}`} onClick={() => toggleCat(c)}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Last played <span className="hint">(date)</span></label>
          <input type="date" value={lastPlayed} onChange={(e) => setLastPlayed(e.target.value)} />
        </div>
        <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
          <label style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={played}
              onChange={(e) => setPlayed(e.target.checked)}
              style={{ width: "auto", marginRight: 8 }}
            />
            Played with Mason
          </label>
        </div>
      </div>

      {msg && <p className="count" style={{ color: "var(--danger)" }}>{msg}</p>}

      <button className="btn" onClick={save} disabled={saving}>
        {saving ? "Saving…" : isEdit ? "💾 Save changes to sheet" : "➕ Add to sheet"}
      </button>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function playerLabel(g: Game): string {
  if (g.minPlayers == null && g.maxPlayers == null) return "players: n/a";
  if (g.minPlayers === g.maxPlayers) return `${g.minPlayers} players`;
  return `${g.minPlayers ?? "?"}–${g.maxPlayers ?? "?"} players`;
}

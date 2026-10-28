"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password");
        return;
      }
      const from = params.get("from") || "/";
      window.location.assign(from.startsWith("/") ? from : "/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container login-wrap">
      <div className="header">
        <h1>Board Game Picker</h1>
        <p>Password required</p>
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <label htmlFor="site-password">Password</label>
        <input
          id="site-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error ? <p className="login-error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

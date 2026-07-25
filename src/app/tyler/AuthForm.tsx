"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One form, two moods. Built for a thumb: 16px inputs (anything smaller and
 * iOS zooms the page on focus), 52px tall targets, the submit button inside
 * the keyboard's reach, and a show/hide toggle so nobody has to type a long
 * password blind on a phone.
 */
export function AuthForm({ mode }: { mode: "claim" | "login" }) {
  const router = useRouter();
  const claim = mode === "claim";

  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tyler/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: claim ? "claim" : "login", code, username, password, confirm }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "That didn't work.");
        setBusy(false);
        return;
      }
      router.push("/tyler/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-base outline-none transition-colors focus:border-white/40";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 pb-16 pt-24">
      <h1 className="text-4xl leading-none md:text-5xl" style={{ fontFamily: "var(--t-display)" }}>
        {claim ? "Set up your login" : "Welcome back"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-white/50">
        {claim
          ? "This happens once. Pick a username and password you'll remember — from here on, this site is yours to run."
          : "Sign in to manage the site."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        {claim && (
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-white/45">Setup code</span>
            <input
              className={`${field} font-mono tracking-[0.2em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              required
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-white/45">Username</span>
          <input
            className={field}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-white/45">Password</span>
          <div className="relative">
            <input
              className={`${field} pr-16`}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={claim ? "new-password" : "current-password"}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wider text-white/45"
            >
              {show ? "hide" : "show"}
            </button>
          </div>
          {claim && <span className="mt-1.5 block text-xs text-white/35">At least 10 characters.</span>}
        </label>

        {claim && (
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-white/45">Confirm password</span>
            <input
              className={field}
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl border px-4 py-3 text-sm"
             style={{ borderColor: "color-mix(in srgb, var(--t-primary) 45%, transparent)", color: "var(--t-primary)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl py-4 text-sm font-bold uppercase tracking-[0.2em] transition-transform active:scale-[0.98] disabled:opacity-50"
          style={{ background: "var(--t-primary)", color: "#fff" }}
        >
          {busy ? "…" : claim ? "Claim the site" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-white/30">
        {claim ? "Rod sent you the code." : "Forgot it? Ask Rod — he can reset it from his machine."}
      </p>
    </main>
  );
}

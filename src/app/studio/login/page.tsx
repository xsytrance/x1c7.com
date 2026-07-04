"use client";

import { useEffect, useState } from "react";

// The owner gate. First visit → "Set your password" (needs the one-time setup
// code from Vercel env). After that → log in. Success drops a session cookie and
// the middleware lets you into /studio anywhere.
export default function LoginPage() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) })
      .then((r) => r.json()).then((j) => setHasPassword(!!j.hasPassword)).catch(() => setHasPassword(false));
  }, []);

  const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;

  const submit = async () => {
    setErr(null);
    if (hasPassword === false && password !== confirm) { setErr("passwords don't match"); return; }
    setBusy(true);
    try {
      const body = hasPassword ? { action: "login", password } : { action: "setup", setupCode, password };
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "failed"); setBusy(false); return; }
      window.location.href = from && from.startsWith("/studio") ? from : "/studio/feed";
    } catch (e) { setErr(String(e)); setBusy(false); }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-void px-6">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-4xl font-black uppercase tracking-tight text-white glow-text" style={{ color: "var(--theme-primary)" }}>Studio</p>
        <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">
          {hasPassword === null ? "…" : hasPassword ? "owner login" : "set your password"}
        </p>

        {hasPassword !== null && (
          <div className="mt-8 space-y-3" onKeyDown={(e) => e.key === "Enter" && submit()}>
            {hasPassword === false && (
              <input value={setupCode} onChange={(e) => setSetupCode(e.target.value)} placeholder="setup code"
                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-center font-mono text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
            )}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={hasPassword ? "password" : "new password"} autoFocus
              className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-center text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
            {hasPassword === false && (
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="confirm password"
                className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-center text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
            )}
            <button onClick={submit} disabled={busy || !password}
              className="w-full rounded-full px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-void transition disabled:opacity-40" style={{ background: "var(--theme-primary)" }}>
              {busy ? "…" : hasPassword ? "enter" : "set password & enter"}
            </button>
            {err && <p className="text-center font-mono text-[11px] text-red-300">{err}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

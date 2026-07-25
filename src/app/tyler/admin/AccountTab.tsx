"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Panel } from "./ui";

export function AccountTab({ username, viaTailnet }: { username: string; viaTailnet: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newUsername, setNewUsername] = useState(username);
  const [note, setNote] = useState<string | null>(null);

  async function send(body: Record<string, string>) {
    const res = await fetch("/api/tyler/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setNote(json.ok ? "Saved." : (json.error ?? "That didn't work."));
    if (json.ok) {
      setCurrent("");
      setPassword("");
      setConfirm("");
      router.refresh();
    }
  }

  return (
    <>
      <Panel title="Your login" hint={viaTailnet
        ? "You're the owner on the tailnet — you can reset Juan's password without knowing the old one."
        : "Change either one. You'll stay signed in."}>
        <Field label="Username" value={newUsername} onChange={setNewUsername} />
        {!viaTailnet && <Field label="Current password" value={current} onChange={setCurrent} type="password" />}
        <Field label="New password" value={password} onChange={setPassword} type="password" hint="At least 10 characters. Leave empty to keep the one you have." />
        {!!password && <Field label="Confirm new password" value={confirm} onChange={setConfirm} type="password" />}
        {note && <p className="text-sm text-white/60">{note}</p>}
        <button
          onClick={() => send({ action: "change", current, password, confirm, newUsername, username })}
          className="w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-[0.15em]"
          style={{ background: "var(--t-primary)", color: "#fff" }}
        >
          Save
        </button>
      </Panel>

      <Panel title="Sign out">
        <button
          onClick={async () => {
            await fetch("/api/tyler/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "logout" }),
            });
            router.push("/tyler");
            router.refresh();
          }}
          className="w-full rounded-xl border border-white/15 py-3.5 text-sm uppercase tracking-[0.15em] text-white/60"
        >
          Sign out
        </button>
      </Panel>
    </>
  );
}

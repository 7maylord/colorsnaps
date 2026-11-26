"use client";

import { useEffect, useState } from "react";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";

export default function PlayerIdentity() {
  const profile = usePlayerProfile();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(profile.name); }, [profile.name]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await profile.save(draft); setEditing(false); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your callsign."); }
  }
  if (!profile.loaded) return null;
  return <section className="player-identity" aria-label="Player profile">
    <div className="identity-avatar" aria-hidden="true">{profile.name ? profile.name[0].toUpperCase() : "?"}</div>
    <div className="identity-copy"><span className="identity-label">PLAYER ONE / YOUR CALLSIGN</span><strong>{profile.name || "Name your player"}</strong><small>Public on Sepolia. Your wallet owns this name and your game results.</small></div>
    {(!profile.name || editing) ? <form className="identity-form" onSubmit={submit}><label className="sr-only" htmlFor="callsign">Player callsign</label><input id="callsign" value={draft} onChange={event => setDraft(event.target.value)} maxLength={20} placeholder="Choose a callsign" autoComplete="nickname" disabled={profile.saving} /><button type="submit" disabled={profile.saving}>{profile.saving ? "Saving on Sepolia…" : "Save name ↗"}</button>{error && <span role="alert">{error}</span>}</form> : <button className="identity-edit" onClick={() => setEditing(true)}>Edit name ✎</button>}
  </section>;
}

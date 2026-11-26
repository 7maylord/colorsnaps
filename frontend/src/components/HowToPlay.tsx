"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "Classic" | "Daily" | "Challenge" | "Duel";
const guides: Record<Mode, { tagline: string; steps: readonly string[]; note: string }> = {
  Classic: { tagline: "The memory run", steps: ["Create a secret puzzle on Sepolia.", "Approve the private reveal. Memorize all five pieces before the shutters close after five seconds.", "Tap one piece, then another to swap them. You have no solve timer.", "Submit your encrypted order and approve private result decryption."], note: "The puzzle and your guess stay encrypted on chain." },
  Daily: { tagline: "Today's one shot", steps: ["Join today's shared puzzle. It changes at 00:00 UTC.", "Memorize the private sequence during the five-second reveal.", "Swap pieces and submit once before the UTC day ends.", "Verify your win/loss proof to appear on today's ranking."], note: "Everyone plays the same hidden sequence, one attempt each." },
  Challenge: { tagline: "Send the signal", steps: ["Create a challenge and copy its invite link to a friend.", "When they join, both of you get the same private pattern. The five-minute clock starts then.", "Memorize, swap, and submit your encrypted arrangement.", "Verify each public win/loss result, then resolve to see the winner."], note: "Only a verified win/loss result is public; the pattern stays private." },
  Duel: { tagline: "Raise the stakes", steps: ["Enter your opponent's wallet address and create a duel.", "Mint free test cUSD if needed. Each player deposits the exact confidential stake and verifies its proof.", "Start the funded duel, memorize the shared pattern, and submit your encrypted order.", "Verify results and settle. A stalled funding round can be cancelled after one hour."], note: "Test cUSD has no value. Each transaction needs Sepolia ETH for gas." },
};

export default function HowToPlay({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const key = `colorsnap:guide:${mode.toLowerCase()}`;
    if (!sessionStorage.getItem(key)) { setOpen(true); sessionStorage.setItem(key, "seen"); }
  }, [mode]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const guide = guides[mode];
  return <><button className="how-button" onClick={() => setOpen(true)} aria-haspopup="dialog">? HOW TO PLAY</button>{open && <div className="how-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><section className="how-dialog" role="dialog" aria-modal="true" aria-labelledby="how-title"><button ref={closeRef} className="how-close" onClick={() => setOpen(false)} aria-label="Close instructions">✕</button><span className="how-kicker">FIELD GUIDE / {mode.toUpperCase()}</span><h2 id="how-title">Ready, <em>player?</em></h2><p>{guide.tagline}</p><ol>{guide.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol><div className="how-note">✳ {guide.note}</div><button className="primary-action" onClick={() => setOpen(false)}>Got it. Let&apos;s play! ↗</button></section></div>}</>;
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import WalletConnectButton from "@/components/WalletConnectButton";
import { GlassPieces, PointerLight } from "@/components/Visuals";
import PlayerIdentity from "@/components/PlayerIdentity";

const modes = [
  { number: "01", slug: "classic", title: "Classic", kicker: "SOLO · NO CLOCK", description: "A private pattern, five seconds to remember, all the time you need to arrange.", mark: "✳", note: "Play alone · Free" },
  { number: "02", slug: "daily", title: "Daily", kicker: "SOLO · ONE PER DAY", description: "The same secret puzzle for everyone. Make your mark on today's board.", mark: "◷", note: "One attempt · Free" },
  { number: "03", slug: "challenge", title: "Challenge", kicker: "TWO PLAYERS · INVITE", description: "Send a friend a link. Two private guesses, one verified winner.", mark: "⇄", note: "Invite a friend · Free" },
  { number: "04", slug: "duel", title: "Duel", kicker: "TWO PLAYERS · TEST STAKE", description: "Place confidential test cUSD on the balance. Play for the pot.", mark: "⚖", note: "Test tokens required" },
];

export default function ModesPage() {
  const { isConnected, status } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("invite");
  const duel = params.get("duel");
  useEffect(() => { if (status !== "reconnecting" && !isConnected) router.replace("/" + window.location.search); }, [isConnected, status, router]);
  if (!isConnected) return <main className="scene waiting">Restoring your account…</main>;
  return <main className="scene modes-scene"><PointerLight /><div className="noise" aria-hidden="true" />
    <header className="site-head"><Link href="/" className="brand">COLOR<span>SNAP</span><i>✳</i></Link><WalletConnectButton /></header>
    <div className="modes-intro"><div><span className="tiny-label"><span className="live-dot" /> THE ARCADE IS OPEN</span><h1>Choose your<br /><em>next adventure.</em></h1></div><p>Five colors. Four ways to play. Your secret stays yours.</p></div>
    <PlayerIdentity /><Link className="leaderboard-shortcut" href="/leaderboard">★ See today&apos;s player board <span>↗</span></Link>
    <div className="mode-grid">{modes.map((mode) => <Link key={mode.slug} href={`/${mode.slug === "classic" ? "game" : mode.slug}${mode.slug === "challenge" && invite ? `?invite=${encodeURIComponent(invite)}` : mode.slug === "duel" && duel ? `?duel=${encodeURIComponent(duel)}` : ""}`} className={`mode-card mode-${mode.slug}`} onPointerMove={event => { if (event.pointerType === "mouse") { const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--card-x", `${event.clientX - rect.left}px`); event.currentTarget.style.setProperty("--card-y", `${event.clientY - rect.top}px`); } }}>
      <div className="mode-top"><span>{mode.number} / {mode.kicker}</span><span className="mode-arrow">↗</span></div>
      <div className="mode-mark" aria-hidden="true">{mode.slug === "classic" ? <GlassPieces compact /> : mode.mark}</div>
      <div><h2>{mode.title}</h2><p>{mode.description}</p></div><div className="mode-bottom">{mode.note}<span>ENTER MODE →</span></div>
    </Link>)}</div><footer className="site-foot"><span>FOUR WAYS TO PLAY</span><span>YOUR SECRET STAYS YOURS</span></footer>
  </main>;
}

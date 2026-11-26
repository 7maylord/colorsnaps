"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { CHAIN_IDS } from "@/config/chains";
import WalletConnectButton from "./WalletConnectButton";
import { PointerLight } from "./Visuals";
import HowToPlay from "./HowToPlay";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";

export const GLASS = [
  { name: "Coral", glyph: "✳", color: "coral" },
  { name: "Blue", glyph: "◈", color: "blue" },
  { name: "Mint", glyph: "✦", color: "mint" },
  { name: "Amber", glyph: "◎", color: "amber" },
  { name: "Violet", glyph: "✣", color: "violet" },
];

export function PlayFrame({ mode, number, description, children }: { mode: "Classic" | "Daily" | "Challenge" | "Duel"; number: string; description: string; children: React.ReactNode }) {
  const { isConnected, status } = useAccount();
  const profile = usePlayerProfile();
  const router = useRouter();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  useEffect(() => { if (status === "disconnected") router.replace("/" + window.location.search); }, [status, router]);
  return <main className="scene play-scene"><PointerLight /><div className="noise" aria-hidden="true" />
    <header className="site-head"><Link href="/modes" className="brand">COLOR<span>SNAP</span><i>✳</i></Link><div className="header-player">{profile.name && <span className="player-badge">★ {profile.name}</span>}<WalletConnectButton /></div></header>
    <nav className="play-nav"><Link href="/modes">← ALL MODES</Link><HowToPlay mode={mode} /><span>{number} / 04</span></nav>
    <div className="play-heading"><div><span className="tiny-label"><span className="live-dot" /> CONFIDENTIAL / {mode.toUpperCase()}</span><h1 className="play-title"><em>{mode}</em> room.</h1></div><p>{description}</p></div>
    {status === "reconnecting" ? <div className="game-notice">Restoring your session…</div> : !isConnected ? <div className="game-notice">Sign in to play. <Link href={typeof window !== "undefined" ? "/" + window.location.search : "/"}>Go to entrance →</Link></div> : chainId !== CHAIN_IDS.ETHEREUM_SEPOLIA ? <div className="game-notice">This room plays on Ethereum Sepolia. <button className="text-action" onClick={() => switchChain({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA })}>Switch network</button></div> : children}
    <footer className="site-foot"><span>PRIVATE PATTERN · PUBLIC PROOF</span><span>BUILT WITH ZAMA FHE</span></footer>
  </main>;
}

export function ColorBoard({ pieces, selected, reveal, onChoose }: { pieces: readonly number[]; selected?: number; reveal?: boolean; onChoose?: (index: number) => void }) {
  const [seconds, setSeconds] = useState(5);
  useEffect(() => {
    if (!reveal) { setSeconds(5); return; }
    setSeconds(5);
    const timer = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [reveal]);
  return <div className={`color-board ${reveal ? "is-reveal" : ""}`} role="group" aria-label={reveal ? "Private pattern to memorize" : "Arrange five colored pieces"}>
    {reveal && <span className="reveal-clock" role="timer" aria-live="polite">HIDES IN {seconds}</span>}
    {pieces.map((color, index) => { const piece = GLASS[color]; return <button key={`${color}-${index}`} type="button" className={`board-piece ${piece.color} ${selected === index ? "selected" : ""}`} onClick={() => onChoose?.(index)} disabled={!onChoose} aria-label={`${piece.name}, position ${index + 1}${selected === index ? ", selected" : ""}`} aria-pressed={selected === index}><span>{piece.glyph}</span><small>{piece.name}</small></button>; })}
  </div>;
}
